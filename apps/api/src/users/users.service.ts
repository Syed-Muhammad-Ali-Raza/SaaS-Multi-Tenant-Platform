import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PasswordService } from "../auth/password.service";
import { AuditService } from "../audit/audit.service";

interface ClientInfo {
  ipAddress?: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly auditService: AuditService
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        isSuperAdmin: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }

  async updateProfile(
    userId: string,
    data: { name?: string },
    client: ClientInfo
  ) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        isSuperAdmin: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    await this.auditService.log({
      actorId: userId,
      organizationId: null,
      action: "user.profile_updated",
      metadata: { changes: data },
      ipAddress: client.ipAddress,
    });

    return updated;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    client: ClientInfo
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      throw new NotFoundException("User not found");
    }

    const valid = await this.passwordService.verify(
      user.passwordHash,
      currentPassword
    );
    if (!valid) {
      const error = new Error("Current password is incorrect") as Error & { status?: number };
      error.status = 400;
      throw error;
    }

    const passwordHash = await this.passwordService.hash(newPassword);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash },
      });

      // Revoke all other sessions.
      await tx.refreshToken.updateMany({
        where: { userId, revoked: false },
        data: { revoked: true },
      });
    });

    await this.auditService.log({
      actorId: userId,
      organizationId: null,
      action: "user.password_changed",
      ipAddress: client.ipAddress,
    });
  }
}