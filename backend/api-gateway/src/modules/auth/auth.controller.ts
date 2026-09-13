import {
  Body, Controller, Post, Req, Res, HttpCode, HttpStatus, UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, RequestContext } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

const REFRESH_COOKIE = 'powerlink_refresh';
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function cookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd || !!process.env.CODESPACE_NAME,
    sameSite: (isProd ? 'lax' : 'none') as 'lax' | 'none',
    path: '/',
    maxAge: REFRESH_MAX_AGE_MS,
  };
}

function ctxOf(req: Request): RequestContext {
  // req.ip is trustworthy ONLY when 'trust proxy' is configured correctly.
  // With TRUST_PROXY=loopback (Codespaces) or =1 (LB), Express peels the
  // spoofable X-Forwarded-For entries and returns the real client address.
  const ip = req.ip ?? null;
  const ua = req.headers['user-agent']?.toString().slice(0, 500) ?? null;
  return { ip, userAgent: ua };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  async requestOtp(@Body() dto: RequestOtpDto, @Req() req: Request) {
    return this.authService.requestOtp(dto.phone, ctxOf(req));
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyOtp(dto.phone, dto.otp, ctxOf(req));

    res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOptions());

    const { refreshToken, ...body } = result;
    return body;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException('No refresh token');

    const tokens = await this.authService.refresh(token, ctxOf(req));

    res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions());

    return { accessToken: tokens.accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE];
    await this.authService.logout(token);
    res.clearCookie(REFRESH_COOKIE, {
      path: '/',
      sameSite: cookieOptions().sameSite,
      secure: cookieOptions().secure,
    });
    return { ok: true };
  }
}