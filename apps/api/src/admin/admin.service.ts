import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async listOrganizations(params: { page?: number; pageSize?: number; search?: string }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));

    const where = params.search
      ? {
          OR: [
            { name: { contains: params.search, mode: "insensitive" as const } },
            { slug: { contains: params.search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [total, items] = await this.prisma.$transaction([
      this.prisma.organization.count({ where }),
      this.prisma.organization.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: {
            select: { memberships: true, invitations: true },
          },
        },
      }),
    ]);

    return { items, total, page, pageSize };
  }

  async listUsers(params: { page?: number; pageSize?: number; search?: string }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));

    const where = params.search
      ? {
          OR: [
            { email: { contains: params.search, mode: "insensitive" as const } },
            { name: { contains: params.search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [total, items] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          name: true,
          isSuperAdmin: true,
          emailVerified: true,
          createdAt: true,
          _count: { select: { memberships: true } },
        },
      }),
    ]);

    return { items, total, page, pageSize };
  }

  async listAuditLogs(params: { page?: number; pageSize?: number }) {
    return this.auditService.list({
      page: params.page,
      pageSize: params.pageSize,
    });
  }
}