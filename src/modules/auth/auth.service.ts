import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../../entities/user.entity.js";
import * as crypto from "crypto";
import * as jwt from "jsonwebtoken";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>
  ) {}

  async loginUser(email: string, password: string) {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

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
    return jwt.sign(
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
