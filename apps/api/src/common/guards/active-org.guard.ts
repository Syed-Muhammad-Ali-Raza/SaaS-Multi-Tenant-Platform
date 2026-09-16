import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { REQUIRE_ORG_KEY } from "../decorators/require-org.decorator";
import { AuthUser } from "../types/auth-user";

@Injectable()
export class ActiveOrgGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requireOrg = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_ORG_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requireOrg) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser;

    if (!user.orgId) {
      throw new ForbiddenException("No active organization selected");
    }

    return true;
  }
}