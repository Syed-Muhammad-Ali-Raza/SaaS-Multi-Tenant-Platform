import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "crypto";
import { Request } from "express";
import { Role, Organization, User } from "saas-shared";
import { AuditService } from "../audit/audit.service";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { SwitchOrgDto } from "./dto/switch-org.dto";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";

interface ClientInfo {
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
  memberships: {
    id: string;
    organizationId: string;
    role: Role;
    status: string;
    organization: Organization;
  }[];
  activeOrg: Organization | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly mailService: MailService
  ) {}

  async register(dto: RegisterDto, client: ClientInfo): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException("An account with this email already exists");
    }

    const passwordHash = await this.passwordService.hash(dto.password);
    const slug = this.generateSlug(dto.orgName);

    const { user, org } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          name: dto.name,
          emailVerified: false,
        },
      });

      const org = await tx.organization.create({
        data: {
          name: dto.orgName,
          slug,
        },
      });

      await tx.membership.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: "ORG_ADMIN",
          status: "ACTIVE",
        },
      });

      return { user, org };
    });

    await this.auditService.log({
      actorId: user.id,
      organizationId: org.id,
      action: "auth.register",
      metadata: { email: user.email },
      ipAddress: client.ipAddress,
    });

    const accessToken = await this.tokenService.generateAccessToken({
      id: user.id,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      orgId: org.id,
      role: "ORG_ADMIN",
    });

    const membership = {
      id: `${user.id}-${org.id}`,
      organizationId: org.id,
      role: "ORG_ADMIN" as Role,
      status: "ACTIVE",
      organization: org,
    };

    return this.toResponse(accessToken, user, [membership], org);
  }

  async login(dto: LoginDto, client: ClientInfo): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        memberships: {
          where: { status: "ACTIVE" },
          include: { organization: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const valid = await this.passwordService.verify(user.passwordHash, dto.password);
    if (!valid) {
      await this.auditService.log({
        actorId: user.id,
        organizationId: null,
        action: "auth.login_failed",
        metadata: { email: user.email },
        ipAddress: client.ipAddress,
      });
      throw new UnauthorizedException("Invalid email or password");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const activeOrg = user.memberships[0]?.organization ?? null;
    const activeRole = user.memberships[0]?.role ?? null;

    const accessToken = await this.tokenService.generateAccessToken({
      id: user.id,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      orgId: activeOrg?.id,
      role: activeRole,
    });

    await this.auditService.log({
      actorId: user.id,
      organizationId: activeOrg?.id ?? null,
      action: "auth.login",
      metadata: {},
      ipAddress: client.ipAddress,
    });

    return this.toResponse(accessToken, user, user.memberships, activeOrg);
  }

  async refresh(
    rawToken: string,
    requestedOrgId: string | undefined,
    client: ClientInfo
  ): Promise<AuthResponse & { rawRefreshToken: string }> {
    const tokenHash = this.tokenService.hashToken(rawToken);

    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            memberships: {
              where: { status: "ACTIVE" },
              include: { organization: true },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });

    if (!record) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (record.revoked) {
      // Reuse of a revoked token strongly suggests theft.
      await this.prisma.refreshToken.updateMany({
        where: { userId: record.userId },
        data: { revoked: true },
      });
      throw new UnauthorizedException("Session has been revoked");
    }

    if (record.expiresAt < new Date()) {
      await this.prisma.refreshToken.update({
        where: { id: record.id },
        data: { revoked: true },
      });
      throw new UnauthorizedException("Session has expired");
    }

    const user = record.user;

    let org: Organization | null = null;
    let role: Role | null = null;

    if (requestedOrgId) {
      const requested = user.memberships.find(
        (m) => m.organizationId === requestedOrgId
      );
      if (requested) {
        org = requested.organization;
        role = requested.role;
      }
    }

    if (!org) {
      org = user.memberships[0]?.organization ?? null;
      role = user.memberships[0]?.role ?? null;
    }

    // Rotation: revoke this token and issue a fresh one.
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revoked: true },
    });

    const { rawToken: rawRefreshToken } = await this.createRefreshTokenRecord(
      user.id,
      client
    );

    const accessToken = await this.tokenService.generateAccessToken({
      id: user.id,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      orgId: org?.id,
      role,
    });

    return {
      ...this.toResponse(accessToken, user, user.memberships, org),
      rawRefreshToken,
    };
  }

  async logout(req: Request, user: { id: string }, client: ClientInfo): Promise<void> {
    const rawToken = req.cookies?.refresh_token as string | undefined;

    if (rawToken) {
      const tokenHash = this.tokenService.hashToken(rawToken);
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { revoked: true },
      });
    } else {
      await this.prisma.refreshToken.updateMany({
        where: { userId: user.id },
        data: { revoked: true },
      });
    }

    await this.auditService.log({
      actorId: user.id,
      action: "auth.logout",
      ipAddress: client.ipAddress,
    });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        isSuperAdmin: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException("User no longer exists");
    }

    const memberships = await this.prisma.membership.findMany({
      where: { userId, status: "ACTIVE" },
      include: { organization: true },
      orderBy: { createdAt: "asc" },
    });

    return { user, memberships };
  }

  async switchOrg(
    userId: string,
    currentOrgId: string | null,
    dto: SwitchOrgDto,
    client: ClientInfo
  ) {
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: dto.organizationId,
        },
      },
      include: { organization: true },
    });

    if (!membership || membership.status !== "ACTIVE") {
      throw new UnauthorizedException("You are not a member of this organization");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        isSuperAdmin: true,
        name: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException("User no longer exists");
    }

    const accessToken = await this.tokenService.generateAccessToken({
      id: user.id,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      orgId: membership.organizationId,
      role: membership.role,
    });

    await this.auditService.log({
      actorId: userId,
      organizationId: membership.organizationId,
      action: "auth.switch_org",
      metadata: { fromOrgId: currentOrgId },
      ipAddress: client.ipAddress,
    });

    return {
      accessToken,
      organization: membership.organization,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto, client: ClientInfo): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    // Always respond identically to prevent email enumeration.
    if (!user) {
      return;
    }

    const rawToken = this.tokenService.generateRawRefreshToken();
    const tokenHash = this.tokenService.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const resetUrl = `${this.configService.get<string>("frontendUrl")}/reset-password?token=${rawToken}`;

    await this.mailService.sendPasswordReset({
      to: user.email,
      resetUrl,
    });

    await this.auditService.log({
      actorId: user.id,
      organizationId: null,
      action: "auth.forgot_password",
      ipAddress: client.ipAddress,
    });
  }

  async resetPassword(dto: ResetPasswordDto, client: ClientInfo): Promise<void> {
    const tokenHash = this.tokenService.hashToken(dto.token);

    const record = await this.prisma.passwordReset.findUnique({
      where: { tokenHash },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid or expired reset token");
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      });

      await tx.passwordReset.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });

      // Sign out every other session.
      await tx.refreshToken.updateMany({
        where: { userId: record.userId, revoked: false },
        data: { revoked: true },
      });
    });

    await this.auditService.log({
      actorId: record.userId,
      organizationId: null,
      action: "auth.password_reset",
      ipAddress: client.ipAddress,
    });
  }

  async createRefreshTokenRecord(
    userId: string,
    client: ClientInfo
  ): Promise<{ rawToken: string; expiresAt: Date }> {
    const rawToken = this.tokenService.generateRawRefreshToken();
    const tokenHash = this.tokenService.hashToken(rawToken);
    const expiresAt = this.tokenService.generateRefreshTokenExpiry();

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        userAgent: client.userAgent,
        ipAddress: client.ipAddress,
      },
    });

    return { rawToken, expiresAt };
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

  private toResponse(
    accessToken: string,
    user: User,
    memberships: AuthResponse["memberships"],
    activeOrg: Organization | null
  ): AuthResponse {
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isSuperAdmin: user.isSuperAdmin,
        emailVerified: user.emailVerified,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      memberships,
      activeOrg,
    };
  }
}