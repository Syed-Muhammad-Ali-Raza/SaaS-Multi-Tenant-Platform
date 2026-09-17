import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes } from "crypto";
import { Role, User } from "saas-shared";

export interface JwtPayload {
  sub: string;
  email: string;
  isSuperAdmin: boolean;
  orgId?: string | null;
  role?: Role | null;
}

export interface AccessTokenUser {
  user: User;
  orgId?: string | null;
  role?: Role | null;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async generateAccessToken(user: {
    id: string;
    email: string;
    isSuperAdmin: boolean;
    orgId?: string | null;
    role?: Role | null;
  }): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      orgId: user.orgId ?? null,
      role: user.role ?? null,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>("jwt.accessSecret"),
      expiresIn: this.configService.get<string>("jwt.accessExpiration"),
    });
  }

  generateRawRefreshToken(): string {
    return randomBytes(48).toString("hex");
  }

  hashToken(rawToken: string): string {
    return createHash("sha256").update(rawToken).digest("hex");
  }

  generateRefreshTokenExpiry(): Date {
    const expiresIn = this.configService.get<string>("jwt.refreshExpiration") ?? "7d";
    const ms = this.parseExpirationToMs(expiresIn);
    return new Date(Date.now() + ms);
  }

  async issueAccessToken(payload: {
    id: string;
    email: string;
    isSuperAdmin: boolean;
    orgId?: string | null;
    role?: Role | null;
  }): Promise<string> {
    return this.generateAccessToken(payload);
  }

  async generateMfaToken(userId: string): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId, purpose: "mfa" },
      {
        secret: this.configService.get<string>("jwt.accessSecret"),
        expiresIn: "5m",
      }
    );
  }

  async verifyMfaToken(token: string): Promise<string> {
    const payload = await this.jwtService.verifyAsync<{
      sub: string;
      purpose?: string;
    }>(token, {
      secret: this.configService.get<string>("jwt.accessSecret"),
    });

    if (!payload?.sub || payload.purpose !== "mfa") {
      throw new Error("Invalid MFA token");
    }

    return payload.sub;
  }

  private parseExpirationToMs(expiration: string): number {
    const match = /^(\d+)([smhd])$/.exec(expiration);
    if (!match) {
      return 7 * 24 * 60 * 60 * 1000;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return value * (multipliers[unit] ?? 1000);
  }
}