import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../../entities/user.entity.js";
import * as crypto from "crypto";
import jwt from "jsonwebtoken";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>
  ) {}

  async loginUser(
    emailOrParams:
      | string
      | {
          email?: string;
          phone?: string;
          identifier?: string;
          loginType?: "email" | "mobile";
          password: string;
        },
    passwordParam?: string
  ) {
    let email: string | undefined;
    let phone: string | undefined;
    let identifier: string | undefined;
    let loginType: "email" | "mobile" | undefined;
    let password = "";

    if (typeof emailOrParams === "object") {
      email = emailOrParams.email;
      phone = emailOrParams.phone;
      identifier = emailOrParams.identifier;
      loginType = emailOrParams.loginType;
      password = emailOrParams.password;
    } else {
      identifier = emailOrParams;
      password = passwordParam || "";
      if (emailOrParams.includes("@")) {
        email = emailOrParams;
        loginType = "email";
      } else {
        const cleaned = emailOrParams.replace(/\D/g, "");
        if (cleaned.length === 10) {
          phone = cleaned;
          loginType = "mobile";
        } else {
          email = emailOrParams;
        }
      }
    }

    let user: User | null = null;

    if (loginType === "mobile" || phone) {
      const targetPhone = (phone || identifier || "").replace(/\D/g, "");
      user = await this.userRepository
        .createQueryBuilder("user")
        .where("user.phone = :rawPhone", { rawPhone: phone || identifier })
        .orWhere("REPLACE(REPLACE(REPLACE(user.phone, ' ', ''), '-', ''), '+91', '') = :digits", { digits: targetPhone })
        .getOne();
    } else if (email || identifier) {
      const normalizedEmail = (email || identifier || "").toLowerCase().trim();
      user = await this.userRepository.findOne({
        where: { email: normalizedEmail },
      });
    }

    // Fallback: search both email and phone if no match yet
    if (!user && identifier) {
      const cleanId = identifier.trim();
      const digits = cleanId.replace(/\D/g, "");
      user = await this.userRepository
        .createQueryBuilder("user")
        .where("LOWER(user.email) = :email", { email: cleanId.toLowerCase() })
        .orWhere("user.phone = :rawPhone", { rawPhone: cleanId })
        .orWhere("REPLACE(REPLACE(REPLACE(user.phone, ' ', ''), '-', ''), '+91', '') = :digits", { digits })
        .getOne();
    }

    if (!user) {
      return null;
    }

    if (!this.isValidPassword(password, user.password)) {
      return null;
    }

    return {
      id: user.id,
      schoolId: user.school_id,
      name: user.name,
      email: user.email,
      role: this.normalizeRole(user.role),
      phone: user.phone,
      avatar: user.avatar_url,
      isActive: user.is_active,
    };
  }

  generateToken(user: any) {
    const jwtSecret = process.env.JWT_SECRET || "sms-jwt-secret";
    const signFn = jwt.sign || (jwt as any).default?.sign;
    return signFn(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        schoolId: user.schoolId,
      },
      jwtSecret,
      { expiresIn: "8h" }
    );
  }

  private normalizeRole(role: string) {
    if (role === "super_admin" || role === "school_admin") {
      return "admin";
    }
    return role;
  }

  private isValidPassword(inputPassword: string, storedPassword: string | null) {
    if (!storedPassword) {
      return false;
    }

    if (storedPassword.startsWith("sha256:")) {
      return storedPassword === `sha256:${this.sha256(inputPassword)}`;
    }

    return storedPassword === inputPassword;
  }

  private sha256(value: string) {
    return crypto.createHash("sha256").update(value).digest("hex");
  }
}
