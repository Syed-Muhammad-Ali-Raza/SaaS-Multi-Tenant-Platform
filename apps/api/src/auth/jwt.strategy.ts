import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Role } from "saas-shared";
import { PrismaService } from "../prisma/prisma.service";
import { JwtPayload } from "./token.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("jwt.accessSecret"),
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub) {
      throw new UnauthorizedException("Invalid token");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        isSuperAdmin: true,
        emailVerified: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException("User no longer exists");
    }

    let orgId: string | null = null;
    let role: Role | null = null;

    if (payload.orgId) {
      const membership = await this.prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: payload.orgId,
          },
        },
        select: { role: true, status: true },
      });

      // Guard against removed or suspended memberships immediately,
      // even if their access token is still valid.
      if (membership && membership.status === "ACTIVE") {
        orgId = payload.orgId;
        role = membership.role;
      }
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isSuperAdmin: user.isSuperAdmin,
      emailVerified: user.emailVerified,
      orgId,
      role,
    };
  }
}