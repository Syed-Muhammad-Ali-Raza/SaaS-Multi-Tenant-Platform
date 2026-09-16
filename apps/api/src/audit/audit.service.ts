import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    params: {
      actorId?: string | null;
      organizationId?: string | null;
      action: string;
      metadata?: Prisma.InputJsonValue;
      ipAddress?: string | null;
    }
  ) {
    return this.prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        organizationId: params.organizationId ?? null,
        action: params.action,
        metadata: params.metadata ?? {},
        ipAddress: params.ipAddress ?? null,
      },
    });
  }

  async list(params: {
    page?: number;
    pageSize?: number;
    organizationId?: string;
    actorId?: string;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));

    const where = {
      ...(params.organizationId ? { organizationId: params.organizationId } : {}),
      ...(params.actorId ? { actorId: params.actorId } : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          actor: { select: { id: true, email: true, name: true } },
          organization: { select: { id: true, name: true, slug: true } },
        },
      }),
    ]);

    return { items, total, page, pageSize };
  }
}