import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  BadRequestException,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { AuthService } from "./auth.service.js";
import { JwtAuthGuard } from "../../common/guards/auth.guard.js";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post()
  async loginPost(@Body() body: any) {
    return this.handleLogin(body);
  }

  @Post("login")
  async login(@Body() body: any) {
    return this.handleLogin(body);
  }

  private async handleLogin(body: any) {
    const { email, phone, user_name, username, identifier, loginType, password } = body;
    const inputIdentifier = identifier || username || user_name || phone || email;

    if (!inputIdentifier || !password) {
      throw new BadRequestException("Username, email, or mobile number and password are required.");
    }

    const strIdentifier = String(inputIdentifier).trim();

    // Check if login is explicitly or implicitly via mobile number
    const isExplicitMobile = loginType === "mobile" || (!!phone && !email && !username && !user_name);
    const isNumericPattern = /^\+?\d[\d\s\-]{7,14}$/.test(strIdentifier) && !strIdentifier.includes("@");

    if (isExplicitMobile || isNumericPattern) {
      const digitsOnly = strIdentifier.replace(/\D/g, "");
      if (digitsOnly.length === 10) {
        // Valid 10-digit phone number
      } else if (loginType === "mobile") {
        throw new BadRequestException("Mobile number must be exactly 10 digits.");
      }
    }

    const user = await this.authService.loginUser({
      email: email ? String(email) : undefined,
      phone: phone ? String(phone) : undefined,
      userName: (username || user_name) ? String(username || user_name) : undefined,
      identifier: strIdentifier,
      loginType: loginType || (isExplicitMobile || isNumericPattern ? "mobile" : "email"),
      password: String(password),
    });

    if (!user) {
      throw new UnauthorizedException("Invalid username, email/mobile number or password.");
    }

    const token = this.authService.generateToken(user);
    return { token, user };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@Req() req: any) {
    return { user: req.user };
  }
}
