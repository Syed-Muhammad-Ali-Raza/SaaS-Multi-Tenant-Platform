import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { randomBytes } from "crypto";
import { Role } from "saas-shared";
import { AuditService } from "../audit/audit.service";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { TokenService } from "../auth/token.service";

interface ClientInfo {
  ipAddress?: string;
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly mailService: MailService,
    private readonly tokenService: TokenService
  ) {}

  async listByUser(userId: string) {
    return this.prisma.membership.findMany({
      where: { userId, status: "ACTIVE" },
      include: { organization: true },
      orderBy: { createdAt: "asc" },
    });
  }

  async create(userId: string, name: string, client: ClientInfo) {
    const slug = this.generateSlug(name);

    const { org, membership } = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name, slug },
      });

      const membership = await tx.membership.create({
        data: {
          userId,
          organizationId: org.id,
          role: "ORG_ADMIN",
          status: "ACTIVE",
        },
      });

      return { org, membership };
    });

    await this.auditService.log({
      actorId: userId,
      organizationId: org.id,
      action: "org.created",
      metadata: { orgName: org.name, slug: org.slug },
      ipAddress: client.ipAddress,
    });

    return { organization: org, membership };
  }

  async findById(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!org) {
      throw new NotFoundException("Organization not found");
    }
    return org;
  }

  async getOrgForMember(orgId: string, userId: string) {
    await this.requireMember(orgId, userId);
    return this.findById(orgId);
  }

  async update(
    orgId: string,
    userId: string,
    data: { name?: string; logoUrl?: string },
    client: ClientInfo
  ) {
    await this.requireOrgAdmin(orgId, userId);

    const updated = await this.prisma.organization.update({
      where: { id: orgId },
      data,
    });

    await this.auditService.log({
      actorId: userId,
      organizationId: orgId,
      action: "org.updated",
      metadata: { changes: data },
      ipAddress: client.ipAddress,
    });

    return updated;
  }

  async remove(orgId: string, userId: string, client: ClientInfo) {
    await this.requireOrgAdmin(orgId, userId);

    await this.prisma.organization.delete({
      where: { id: orgId },
    });

    await this.auditService.log({
      actorId: userId,
      organizationId: orgId,
      action: "org.deleted",
      metadata: {},
      ipAddress: client.ipAddress,
    });
  }

  async listMembers(orgId: string, userId: string) {
    await this.requireMember(orgId, userId);

    return this.prisma.membership.findMany({
      where: { organizationId: orgId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            emailVerified: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async updateMemberRole(
    orgId: string,
    targetUserId: string,
    role: Role,
    actorUserId: string,
    client: ClientInfo
  ) {
    await this.requireOrgAdmin(orgId, actorUserId);

    if (targetUserId === actorUserId) {
      throw new ForbiddenException("You cannot change your own role");
    }

    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: targetUserId,
          organizationId: orgId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException("Member not found in this organization");
    }

    const updated = await this.prisma.membership.update({
      where: { id: membership.id },
      data: { role },
    });

    await this.auditService.log({
      actorId: actorUserId,
      organizationId: orgId,
      action: "member.role_changed",
      metadata: { targetUserId, newRole: role, oldRole: membership.role },
      ipAddress: client.ipAddress,
    });

    return updated;
  }

  async removeMember(
    orgId: string,
    targetUserId: string,
    actorUserId: string,
    client: ClientInfo
  ) {
    await this.requireOrgAdmin(orgId, actorUserId);

    if (targetUserId === actorUserId) {
      throw new ForbiddenException("You cannot remove yourself");
    }

    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: targetUserId,
          organizationId: orgId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException("Member not found in this organization");
    }

    await this.prisma.membership.delete({
      where: { id: membership.id },
    });

    // Revoke all refresh tokens for removed user immediately.
    await this.prisma.refreshToken.updateMany({
      where: { userId: targetUserId },
      data: { revoked: true },
    });

    await this.auditService.log({
      actorId: actorUserId,
      organizationId: orgId,
      action: "member.removed",
      metadata: { targetUserId, role: membership.role },
      ipAddress: client.ipAddress,
    });
  }

  async createInvitation(
    orgId: string,
    email: string,
    role: Role,
    actorUserId: string,
    client: ClientInfo
  ) {
    await this.requireOrgAdmin(orgId, actorUserId);

    const existing = await this.prisma.membership.findFirst({
      where: { organizationId: orgId, user: { email: email.toLowerCase() } },
    });

    if (existing) {
      throw new ForbiddenException("This user is already a member of this organization");
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, slug: true },
    });
    if (!org) {
      throw new NotFoundException("Organization not found");
    }

    const rawToken = this.tokenService.generateRawRefreshToken();
    const tokenHash = this.tokenService.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await this.prisma.invitation.create({
      data: {
        email: email.toLowerCase(),
        organizationId: orgId,
        role,
        tokenHash,
        expiresAt,
        invitedById: actorUserId,
      },
      include: {
        organization: true,
        invitedBy: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    const frontendUrl =
      process.env.FRONTEND_URL ?? "http://localhost:3001";
    const inviteUrl = `${frontendUrl}/accept-invite?token=${rawToken}`;

    await this.mailService.sendInvitation({
      to: email,
      orgName: org.name,
      inviteUrl,
      role: role.toLowerCase().replace("_", " "),
    });

    await this.auditService.log({
      actorId: actorUserId,
      organizationId: orgId,
      action: "invitation.created",
      metadata: { email, role },
      ipAddress: client.ipAddress,
    });

    return invitation;
  }

  async listInvitations(orgId: string, userId: string) {
    await this.requireOrgAdmin(orgId, userId);

    return this.prisma.invitation.findMany({
      where: {
        organizationId: orgId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        invitedBy: {
          select: { id: true, email: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async revokeInvitation(
    orgId: string,
    invitationId: string,
    userId: string,
    client: ClientInfo
  ) {
    await this.requireOrgAdmin(orgId, userId);

    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, organizationId: orgId },
    });

    if (!invitation) {
      throw new NotFoundException("Invitation not found");
    }

    await this.prisma.invitation.delete({
      where: { id: invitationId },
    });

    await this.auditService.log({
      actorId: userId,
      organizationId: orgId,
      action: "invitation.revoked",
      metadata: { email: invitation.email, role: invitation.role },
      ipAddress: client.ipAddress,
    });
  }

  async getInvitationByToken(rawToken: string) {
    const tokenHash = this.tokenService.hashToken(rawToken);

    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!invitation) {
      throw new NotFoundException("Invalid invitation");
    }

    if (invitation.acceptedAt) {
      throw new ForbiddenException("Invitation already accepted");
    }

    if (invitation.expiresAt < new Date()) {
      throw new ForbiddenException("Invitation has expired");
    }

    return invitation;
  }

  async acceptInvitation(
    rawToken: string,
    data: {
      name?: string;
      password?: string;
    },
    client: ClientInfo
  ) {
    const invitation = await this.getInvitationByToken(rawToken);
    const tokenHash = this.tokenService.hashToken(rawToken);

    let user = await this.prisma.user.findUnique({
      where: { email: invitation.email },
    });

    const isNewUser = !user;

    if (isNewUser) {
      if (!data.name || !data.password) {
        throw new ForbiddenException(
          "Name and password are required for new accounts"
        );
      }

      const argon2 = await import("argon2");
      const passwordHash = await argon2.hash(data.password);

      user = await this.prisma.user.create({
        data: {
          email: invitation.email,
          passwordHash,
          name: data.name,
          emailVerified: false,
        },
      });
    }

    const { membership } = await this.prisma.$transaction(async (tx) => {
      const membership = await tx.membership.create({
        data: {
          userId: user!.id,
          organizationId: invitation.organizationId,
          role: invitation.role,
          status: "ACTIVE",
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          acceptedAt: new Date(),
          acceptedById: user!.id,
        },
      });

      return { membership };
    });

    await this.auditService.log({
      actorId: user!.id,
      organizationId: invitation.organizationId,
      action: "invitation.accepted",
      metadata: {
        email: invitation.email,
        role: invitation.role,
        isNewUser,
      },
      ipAddress: client.ipAddress,
    });

    const accessToken = await this.tokenService.generateAccessToken({
      id: user!.id,
      email: user!.email,
      isSuperAdmin: user!.isSuperAdmin,
      orgId: invitation.organizationId,
      role: invitation.role,
    });

    return {
      accessToken,
      isNewUser,
      organization: invitation.organization,
      role: invitation.role,
    };
  }

  async createAcceptanceRefreshToken(
    rawToken: string,
    req: { ip?: string; headers: Record<string, string | string[] | undefined> }
  ): Promise<string | null> {
    const tokenHash = this.tokenService.hashToken(rawToken);

    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash },
      select: { acceptedById: true },
    });

    if (!invitation?.acceptedById) {
      return null;
    }

    const rawRefreshToken = this.tokenService.generateRawRefreshToken();
    const hash = this.tokenService.hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId: invitation.acceptedById,
        tokenHash: hash,
        expiresAt,
        ipAddress: req.ip,
        userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
      },
    });

    return rawRefreshToken;
  }

  private async requireOrgAdmin(orgId: string, userId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: { userId, organizationId: orgId },
      },
      select: { role: true, status: true },
    });

    if (!membership || membership.status !== "ACTIVE") {
      throw new ForbiddenException("You are not a member of this organization");
    }

    if (membership.role !== "ORG_ADMIN") {
      throw new ForbiddenException("Only organization admins can perform this action");
    }
  }

  private async requireMember(orgId: string, userId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: { userId, organizationId: orgId },
      },
      select: { status: true },
    });

    if (!membership || membership.status !== "ACTIVE") {
      throw new ForbiddenException("You are not a member of this organization");
    }
  }

  private generateSlug(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    const suffix = randomBytes(3).toString("hex");
    return `${base || "org"}-${suffix}`;
  }
}