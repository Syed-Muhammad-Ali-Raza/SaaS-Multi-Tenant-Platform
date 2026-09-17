import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "crypto";
import { Request } from "express";
import {
  generateSync as generateOtp,
  generateSecret as generateOtpSecret,
  generateURI as generateOtpUri,
  verifySync as verifyOtp,
} from "otplib";
import * as QRCode from "qrcode";
import { Role, Organization, User } from "saas-shared";
import { AuditService } from "../audit/audit.service";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { SwitchOrgDto } from "./dto/switch-org.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { DisableTwoFactorDto } from "./dto/twofa-disable.dto";
import { EnableTwoFactorDto } from "./dto/twofa-enable.dto";
import { VerifyTwoFactorDto } from "./dto/twofa-verify.dto";
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

export interface MfaRequiredResponse {
  requiresTwoFactor: true;
  mfaToken: string;
}

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

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
        data: { name: dto.orgName, slug },
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

    await this.sendVerificationEmail(user.id, client, user.email);

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

  async login(
    dto: LoginDto,
    client: ClientInfo
  ): Promise<AuthResponse | MfaRequiredResponse> {
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

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60_000
      );
      throw new UnauthorizedException(
        `Account locked. Try again in ${minutes} minute${minutes > 1 ? "s" : ""}`
      );
    }

    const valid = await this.passwordService.verify(
      user.passwordHash,
      dto.password
    );

    if (!valid) {
      const attempts = (user.loginAttempts ?? 0) + 1;
      const lockUntil =
        attempts >= MAX_LOGIN_ATTEMPTS
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
          : undefined;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: attempts >= MAX_LOGIN_ATTEMPTS ? 0 : attempts,
          ...(lockUntil ? { lockedUntil: lockUntil } : {}),
        },
      });

      await this.auditService.log({
        actorId: user.id,
        action: "auth.login_failed",
        metadata: { attempts },
        ipAddress: client.ipAddress,
      });

      throw new UnauthorizedException("Invalid email or password");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: 0, lockedUntil: null },
    });

    if (user.twoFactorEnabled) {
      const mfaToken = await this.tokenService.generateMfaToken(user.id);

      await this.auditService.log({
        actorId: user.id,
        action: "auth.mfa_challenge",
        ipAddress: client.ipAddress,
      });

      return { requiresTwoFactor: true, mfaToken };
    }

    return this.finalizeLogin(user, user.memberships, client);
  }

  async verifyTwoFactor(
    dto: VerifyTwoFactorDto,
    client: ClientInfo
  ): Promise<AuthResponse> {
    let userId: string;

    try {
      userId = await this.tokenService.verifyMfaToken(dto.mfaToken);
    } catch {
      throw new UnauthorizedException("Invalid or expired MFA token");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: { status: "ACTIVE" },
          include: { organization: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException("Two-factor authentication is not configured");
    }

    const code = dto.code.replace(/\s/g, "").toUpperCase();
    const isTotp = /^\d{6}$/.test(code);

    if (isTotp) {
      const valid = verifyOtp({
        token: code,
        secret: user.twoFactorSecret,
      }).valid;

      if (!valid) {
        await this.auditService.log({
          actorId: user.id,
          action: "auth.mfa_failed",
          ipAddress: client.ipAddress,
        });
        throw new UnauthorizedException("Invalid authentication code");
      }
    } else {
      const backupCodes: string[] = user.twoFactorBackupCodes
        ? JSON.parse(user.twoFactorBackupCodes)
        : [];

      const matched = backupCodes.find(
        (c) => c.replace(/-/g, "") === code.replace(/-/g, "")
      );

      if (!matched) {
        await this.auditService.log({
          actorId: user.id,
          action: "auth.mfa_failed",
          metadata: { type: "backup" },
          ipAddress: client.ipAddress,
        });
        throw new UnauthorizedException("Invalid authentication code");
      }

      const updatedCodes = backupCodes.filter((c) => c !== matched);
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorBackupCodes: JSON.stringify(updatedCodes),
        },
      });
    }

    await this.auditService.log({
      actorId: user.id,
      action: "auth.mfa_verified",
      ipAddress: client.ipAddress,
    });

    return this.finalizeLogin(user, user.memberships, client);
  }

  async verifyEmail(
    dto: VerifyEmailDto,
    client: ClientInfo
  ): Promise<{ message: string }> {
    const tokenHash = this.tokenService.hashToken(dto.token);

    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException("Invalid or expired verification token");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: record.userId },
        data: { emailVerified: true },
      });

      await tx.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
    });

    await this.auditService.log({
      actorId: record.userId,
      action: "auth.email_verified",
      ipAddress: client.ipAddress,
    });

    return { message: "Email verified successfully" };
  }

  async sendVerificationEmailForUser(
    userId: string,
    client: ClientInfo
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, emailVerified: true },
    });

    if (!user) throw new UnauthorizedException("User not found");
    if (user.emailVerified)
      return { message: "Email is already verified" };

    await this.sendVerificationEmail(userId, client, user.email);
    return { message: "Verification email sent" };
  }

  async setupTwoFactor(
    userId: string,
    client: ClientInfo
  ): Promise<{ secret: string; otpauthUrl: string; backupCodes: string[] }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException("User not found");
    if (user.twoFactorEnabled)
      throw new BadRequestException("2FA is already enabled");

    const secret = generateOtpSecret();
    const backupCodes = this.generateBackupCodes();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorSecret: secret,
        twoFactorBackupCodes: JSON.stringify(backupCodes),
      },
    });

    const appName = "SaaS Platform";
    const otpauthUrl = generateOtpUri({
      issuer: appName,
      label: user.email,
      secret,
      strategy: "totp",
    });

    await this.auditService.log({
      actorId: user.id,
      action: "auth.2fa_setup",
      ipAddress: client.ipAddress,
    });

    return { secret, otpauthUrl, backupCodes };
  }

  async enableTwoFactor(
    userId: string,
    dto: EnableTwoFactorDto,
    client: ClientInfo
  ): Promise<{ backupCodes: string[] }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException("User not found");
    if (user.twoFactorEnabled)
      throw new BadRequestException("2FA is already enabled");
    if (!user.twoFactorSecret)
      throw new BadRequestException("Call /auth/2fa/setup first");

    const valid = verifyOtp({
      token: dto.code,
      secret: user.twoFactorSecret,
    }).valid;

    if (!valid) {
      throw new BadRequestException("Invalid code. Check your authenticator app.");
    }

    const backupCodes = this.generateBackupCodes();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorBackupCodes: JSON.stringify(backupCodes),
      },
    });

    await this.auditService.log({
      actorId: user.id,
      action: "auth.2fa_enabled",
      ipAddress: client.ipAddress,
    });

    return { backupCodes };
  }

  async disableTwoFactor(
    userId: string,
    dto: DisableTwoFactorDto,
    client: ClientInfo
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException("User not found");
    if (!user.twoFactorEnabled)
      throw new BadRequestException("2FA is not enabled");
    if (!user.passwordHash) throw new UnauthorizedException("No password set");

    const passwordValid = await this.passwordService.verify(
      user.passwordHash,
      dto.currentPassword
    );
    if (!passwordValid)
      throw new UnauthorizedException("Incorrect password");

    const codeValid = user.twoFactorSecret
      ? verifyOtp({ token: dto.code, secret: user.twoFactorSecret }).valid
      : false;

    if (!codeValid)
      throw new BadRequestException("Invalid authentication code");

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
      },
    });

    await this.auditService.log({
      actorId: user.id,
      action: "auth.2fa_disabled",
      ipAddress: client.ipAddress,
    });

    return { message: "2FA disabled" };
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
        twoFactorEnabled: true,
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
      select: { id: true, email: true, isSuperAdmin: true, name: true },
    });

    if (!user) throw new UnauthorizedException("User no longer exists");

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

    return { accessToken, organization: membership.organization };
  }

  async forgotPassword(dto: ForgotPasswordDto, client: ClientInfo): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) return;

    const rawToken = this.tokenService.generateRawRefreshToken();
    const tokenHash = this.tokenService.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.passwordReset.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const resetUrl = `${this.configService.get<string>("frontendUrl")}/reset-password?token=${rawToken}`;

    await this.mailService.sendPasswordReset({ to: user.email, resetUrl });

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

  private async finalizeLogin(
    user: any,
    memberships: any[],
    client: ClientInfo
  ): Promise<AuthResponse> {
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const activeOrg = memberships[0]?.organization ?? null;
    const activeRole = memberships[0]?.role ?? null;

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
      metadata: { twoFactor: user.twoFactorEnabled },
      ipAddress: client.ipAddress,
    });

    return this.toResponse(accessToken, user, memberships, activeOrg);
  }

  private async sendVerificationEmail(
    userId: string,
    client: ClientInfo,
    email: string
  ): Promise<void> {
    const rawToken = this.tokenService.generateRawRefreshToken();
    const tokenHash = this.tokenService.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.emailVerificationToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    const verifyUrl = `${this.configService.get<string>("frontendUrl")}/verify-email?token=${rawToken}`;

    await this.mailService.sendVerificationEmail({ to: email, verifyUrl });
  }

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 8; i++) {
      const seg = randomBytes(4).toString("hex").toUpperCase();
      codes.push(`${seg.slice(0, 4)}-${seg.slice(4)}`);
    }
    return codes;
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
    user: any,
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
        twoFactorEnabled: user.twoFactorEnabled,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      } as User,
      memberships,
      activeOrg,
    };
  }
}
