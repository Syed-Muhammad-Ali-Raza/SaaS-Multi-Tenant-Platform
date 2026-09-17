import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import { Request, Response } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { AuthUser } from "../common/types/auth-user";
import { AuthService, AuthResponse } from "./auth.service";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { SwitchOrgDto } from "./dto/switch-org.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { DisableTwoFactorDto } from "./dto/twofa-disable.dto";
import { EnableTwoFactorDto } from "./dto/twofa-enable.dto";
import { VerifyTwoFactorDto } from "./dto/twofa-verify.dto";

const REFRESH_COOKIE = "refresh_token";
const REFRESH_TOKEN_MS = 7 * 24 * 60 * 60 * 1000;

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("register")
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.authService.register(dto, this.getClientInfo(req));
    const { rawToken } = await this.authService.createRefreshTokenRecord(
      result.user.id,
      this.getClientInfo(req)
    );
    this.setRefreshTokenCookie(res, rawToken);
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("login")
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.authService.login(dto, this.getClientInfo(req));

    if ("requiresTwoFactor" in result && result.requiresTwoFactor) {
      return result;
    }

    const authResult = result as AuthResponse;

    const { rawToken } = await this.authService.createRefreshTokenRecord(
      authResult.user.id,
      this.getClientInfo(req)
    );
    this.setRefreshTokenCookie(res, rawToken);
    return authResult;
  }

  @Public()
  @Post("refresh")
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const rawToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;

    if (!rawToken) {
      throw new UnauthorizedException("No refresh token provided");
    }

    const result = await this.authService.refresh(
      rawToken,
      dto.activeOrgId,
      this.getClientInfo(req)
    );

    this.setRefreshTokenCookie(res, result.rawRefreshToken);
    const { rawRefreshToken: _raw, ...payload } = result;
    return payload;
  }

  @Post("logout")
  async logout(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    await this.authService.logout(req, { id: user.id }, this.getClientInfo(req));
    this.clearRefreshTokenCookie(res);
    return { message: "Logged out" };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("verify-email")
  async verifyEmail(@Body() dto: VerifyEmailDto, @Req() req: Request) {
    return this.authService.verifyEmail(dto, this.getClientInfo(req));
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("send-verification-email")
  async sendVerificationEmail(
    @CurrentUser() user: AuthUser,
    @Req() req: Request
  ) {
    return this.authService.sendVerificationEmailForUser(
      user.id,
      this.getClientInfo(req)
    );
  }

  @Post("2fa/setup")
  async setupTwoFactor(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.authService.setupTwoFactor(user.id, this.getClientInfo(req));
  }

  @Post("2fa/enable")
  async enableTwoFactor(
    @CurrentUser() user: AuthUser,
    @Body() dto: EnableTwoFactorDto,
    @Req() req: Request
  ) {
    return this.authService.enableTwoFactor(user.id, dto, this.getClientInfo(req));
  }

  @Post("2fa/disable")
  async disableTwoFactor(
    @CurrentUser() user: AuthUser,
    @Body() dto: DisableTwoFactorDto,
    @Req() req: Request
  ) {
    return this.authService.disableTwoFactor(user.id, dto, this.getClientInfo(req));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("2fa/verify")
  async verifyTwoFactor(
    @Body() dto: VerifyTwoFactorDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.authService.verifyTwoFactor(
      dto,
      this.getClientInfo(req)
    );
    const { rawToken } = await this.authService.createRefreshTokenRecord(
      result.user.id,
      this.getClientInfo(req)
    );
    this.setRefreshTokenCookie(res, rawToken);
    return result;
  }

  @Get("me")
  async me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.id);
  }

  @Post("switch-org")
  async switchOrg(
    @CurrentUser() user: AuthUser,
    @Body() dto: SwitchOrgDto,
    @Req() req: Request
  ) {
    return this.authService.switchOrg(user.id, user.orgId, dto, this.getClientInfo(req));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("forgot-password")
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    await this.authService.forgotPassword(dto, this.getClientInfo(req));
    return {
      message:
        "If an account exists for that email, a password reset link has been sent.",
    };
  }

  @Public()
  @Post("reset-password")
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    await this.authService.resetPassword(dto, this.getClientInfo(req));
    return { message: "Password has been reset. You can now log in." };
  }

  private getClientInfo(req: Request): { ipAddress?: string; userAgent?: string } {
    return {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    };
  }

  private setRefreshTokenCookie(res: Response, rawToken: string): void {
    const isProduction =
      this.configService.get<string>("nodeEnv") === "production";
    const domain = this.configService.get<string>("cookieDomain");

    res.cookie(REFRESH_COOKIE, rawToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      expires: new Date(Date.now() + REFRESH_TOKEN_MS),
      ...(domain && domain !== "localhost" ? { domain } : {}),
    });
  }

  private clearRefreshTokenCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, {
      path: "/",
      httpOnly: true,
      secure: this.configService.get<string>("nodeEnv") === "production",
      sameSite: "lax",
    });
  }
}