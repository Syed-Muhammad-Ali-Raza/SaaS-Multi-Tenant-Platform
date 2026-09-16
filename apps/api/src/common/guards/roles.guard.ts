import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "saas-shared";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { AuthUser } from "../types/auth-user";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser;

    if (!user) {
      throw new ForbiddenException("Access denied");
    }

    // Super admins bypass org-scoped role checks.
    if (user.isSuperAdmin) {
      return true;
    }

    if (!user.orgId || !user.role) {
      throw new ForbiddenException("No active organization");
    }

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException(
        "You do not have permission to perform this action"
      );
    }

    return true;
  }
}