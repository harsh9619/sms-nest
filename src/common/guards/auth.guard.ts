import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import jwt from "jsonwebtoken";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException("Authentication token required.");
    }

    const token = authHeader.slice(7).trim();
    const jwtSecret = process.env.JWT_SECRET || "sms-jwt-secret";

    try {
      const verifyFn = jwt.verify || (jwt as any).default?.verify;
      const decoded = verifyFn(token, jwtSecret);
      request.user = decoded;
      return true;
    } catch (error) {
      throw new UnauthorizedException("Invalid or expired token.");
    }
  }
}
