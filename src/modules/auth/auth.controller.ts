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
    const { email, password } = body;

    if (!email || !password) {
      throw new BadRequestException("Email and password are required.");
    }

    const user = await this.authService.loginUser(String(email), String(password));

    if (!user) {
      throw new UnauthorizedException("Invalid email or password.");
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
