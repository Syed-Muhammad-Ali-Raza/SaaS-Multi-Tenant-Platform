import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsString, Matches, MaxLength, MinLength } from "class-validator";
import { Request } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/types/auth-user";
import { UsersService } from "./users.service";

class UpdateProfileDto {
  @IsString()
  @MaxLength(100)
  name!: string;
}

class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/)
  newPassword!: string;
}

@Controller("users")
@UseGuards(AuthGuard("jwt"))
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  async me(@CurrentUser() user: AuthUser) {
    return this.usersService.getProfile(user.id);
  }

  @Patch("me")
  async updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
    @Req() req: Request
  ) {
    return this.usersService.updateProfile(user.id, dto, { ipAddress: req.ip });
  }

  @Post("me/change-password")
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request
  ) {
    try {
      await this.usersService.changePassword(
        user.id,
        dto.currentPassword,
        dto.newPassword,
        { ipAddress: req.ip }
      );
    } catch (error) {
      if (error instanceof Error && (error as Error & { status?: number }).status) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
    return { message: "Password changed. Other sessions have been signed out." };
  }
}