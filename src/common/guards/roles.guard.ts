import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator.js";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException("Access denied: User not authenticated.");
    }

    const userRole = (user.role || "").toLowerCase();
    const normalizedUserRole =
      userRole === "super_admin" || userRole === "school_admin" ? "admin" : userRole;

    const hasRole = requiredRoles.some((role) => {
      const normalizedRole = role.toLowerCase();
      if (normalizedRole === "admin") {
        return (
          normalizedUserRole === "admin" ||
          userRole === "super_admin" ||
          userRole === "school_admin"
        );
      }
      return userRole === normalizedRole || normalizedUserRole === normalizedRole;
    });

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied: Role '${user.role}' is not authorized to access this resource.`
      );
    }

    return true;
  }
}
