import {
  Body, Controller, Post, Req, Res, HttpCode, HttpStatus, UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/login.dto';

const ADMIN_REFRESH_COOKIE = 'powerlink_admin_refresh';
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function adminCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd || !!process.env.CODESPACE_NAME,
    sameSite: (isProd ? 'lax' : 'none') as 'lax' | 'none',
    path: '/',
    maxAge: REFRESH_MAX_AGE_MS,
  };
}

function ctxOf(req: Request) {
  return {
    ip: req.ip ?? null,
    userAgent: req.headers['user-agent']?.toString().slice(0, 500) ?? null,
  };
}

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: AdminLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.adminAuthService.login(dto.email, dto.password, ctxOf(req));

    res.cookie(ADMIN_REFRESH_COOKIE, result.refreshToken, adminCookieOptions());

    const { refreshToken, ...body } = result;
    return body;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[ADMIN_REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException('No refresh token');

    const tokens = await this.adminAuthService.refresh(token, ctxOf(req));

    if (tokens.refreshToken) {
      res.cookie(ADMIN_REFRESH_COOKIE, tokens.refreshToken, adminCookieOptions());
    }

    return { accessToken: tokens.accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[ADMIN_REFRESH_COOKIE];
    await this.adminAuthService.logout(token);
    res.clearCookie(ADMIN_REFRESH_COOKIE, {
      path: '/',
      sameSite: adminCookieOptions().sameSite,
      secure: adminCookieOptions().secure,
    });
    return { ok: true };
  }
}
