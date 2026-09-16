import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Role } from "saas-shared";
import { Request, Response } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthUser } from "../common/types/auth-user";
import { TokenService } from "../auth/token.service";
import { CreateOrgDto } from "./dto/create-org.dto";
import { UpdateOrgDto } from "./dto/update-org.dto";
import { OrganizationsService } from "./organizations.service";

@Controller()
export class OrganizationsController {
  constructor(
    private readonly orgService: OrganizationsService,
    private readonly tokenService: TokenService
  ) {}

  @Get("orgs")
  async listOrgs(@CurrentUser() user: AuthUser) {
    return this.orgService.listByUser(user.id);
  }

  @Post("orgs")
  async createOrg(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOrgDto,
    @Req() req: Request
  ) {
    return this.orgService.create(user.id, dto.name, { ipAddress: req.ip });
  }

  @Get("orgs/:id")
  async getOrg(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.orgService.getOrgForMember(id, user.id);
  }

  @Patch("orgs/:id")
  @Roles(Role.ORG_ADMIN)
  @UseGuards(RolesGuard)
  async updateOrg(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateOrgDto,
    @Req() req: Request
  ) {
    return this.orgService.update(id, user.id, dto, { ipAddress: req.ip });
  }

  @Delete("orgs/:id")
  @Roles(Role.ORG_ADMIN)
  @UseGuards(RolesGuard)
  async deleteOrg(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Req() req: Request
  ) {
    await this.orgService.remove(id, user.id, { ipAddress: req.ip });
    return { message: "Organization deleted" };
  }

  @Get("orgs/:orgId/members")
  async listMembers(@CurrentUser() user: AuthUser, @Param("orgId") orgId: string) {
    return this.orgService.listMembers(orgId, user.id);
  }

  @Patch("orgs/:orgId/members/:userId")
  @Roles(Role.ORG_ADMIN)
  @UseGuards(RolesGuard)
  async updateMemberRole(
    @CurrentUser() user: AuthUser,
    @Param("orgId") orgId: string,
    @Param("userId") targetUserId: string,
    @Body("role") role: Role,
    @Req() req: Request
  ) {
    return this.orgService.updateMemberRole(orgId, targetUserId, role, user.id, {
      ipAddress: req.ip,
    });
  }

  @Delete("orgs/:orgId/members/:userId")
  @Roles(Role.ORG_ADMIN)
  @UseGuards(RolesGuard)
  async removeMember(
    @CurrentUser() user: AuthUser,
    @Param("orgId") orgId: string,
    @Param("userId") targetUserId: string,
    @Req() req: Request
  ) {
    await this.orgService.removeMember(orgId, targetUserId, user.id, {
      ipAddress: req.ip,
    });
    return { message: "Member removed" };
  }

  @Post("orgs/:orgId/invitations")
  @Roles(Role.ORG_ADMIN)
  @UseGuards(RolesGuard)
  async createInvitation(
    @CurrentUser() user: AuthUser,
    @Param("orgId") orgId: string,
    @Body("email") email: string,
    @Body("role") role: Role,
    @Req() req: Request
  ) {
    return this.orgService.createInvitation(orgId, email, role, user.id, {
      ipAddress: req.ip,
    });
  }

  @Get("orgs/:orgId/invitations")
  @Roles(Role.ORG_ADMIN)
  @UseGuards(RolesGuard)
  async listInvitations(
    @CurrentUser() user: AuthUser,
    @Param("orgId") orgId: string
  ) {
    return this.orgService.listInvitations(orgId, user.id);
  }

  @Delete("orgs/:orgId/invitations/:id")
  @Roles(Role.ORG_ADMIN)
  @UseGuards(RolesGuard)
  async revokeInvitation(
    @CurrentUser() user: AuthUser,
    @Param("orgId") orgId: string,
    @Param("id") invitationId: string,
    @Req() req: Request
  ) {
    await this.orgService.revokeInvitation(orgId, invitationId, user.id, {
      ipAddress: req.ip,
    });
    return { message: "Invitation revoked" };
  }

  @Public()
  @Get("invitations/:token")
  async getInvitation(@Param("token") token: string) {
    return this.orgService.getInvitationByToken(token);
  }

  @Public()
  @Post("invitations/:token/accept")
  async acceptInvitation(
    @Param("token") token: string,
    @Body() body: { name?: string; password?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.orgService.acceptInvitation(token, body, {
      ipAddress: req.ip,
    });

    const refreshToken = await this.orgService.createAcceptanceRefreshToken(
      token,
      req
    );

    if (refreshToken) {
      const isProduction = process.env.NODE_ENV === "production";
      res.cookie("refresh_token", refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        path: "/",
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    }

    return result;
  }
}