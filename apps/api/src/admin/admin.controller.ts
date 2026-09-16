import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { AdminService } from "./admin.service";
import { SuperAdminGuard } from "../common/guards/super-admin.guard";

@Controller("admin")
@UseGuards(AuthGuard("jwt"), SuperAdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("organizations")
  async listOrganizations(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("search") search?: string
  ) {
    return this.adminService.listOrganizations({
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      search,
    });
  }

  @Get("users")
  async listUsers(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("search") search?: string
  ) {
    return this.adminService.listUsers({
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      search,
    });
  }

  @Get("audit-logs")
  async listAuditLogs(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string
  ) {
    return this.adminService.listAuditLogs({
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 50,
    });
  }
}