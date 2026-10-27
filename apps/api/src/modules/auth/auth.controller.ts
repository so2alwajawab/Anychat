import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CSRF_COOKIE, randomToken } from '@anychat/shared';
import { Public } from '../../common/decorators/public.decorator.js';
import { clearAuthCookies, setCsrfCookie, setSessionCookie } from '../../common/cookies.js';
import { AuthService } from './auth.service.js';
import { LoginDto, RecoveryDto } from './dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get('csrf')
  csrf(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const existing = req.cookies?.[CSRF_COOKIE] as string | undefined;
    const token = existing && existing.length >= 20 ? existing : randomToken(32);
    setCsrfCookie(res, token);
    return { csrfToken: token };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, session } = await this.authService.login(dto, req);
    setSessionCookie(res, session.token);
    setCsrfCookie(res, session.csrfToken);
    return { user };
  }

  @Public()
  @Post('recovery')
  @HttpCode(200)
  async recovery(
    @Body() dto: RecoveryDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, session, recoveryCode } = await this.authService.recover(dto, req);
    setSessionCookie(res, session.token);
    setCsrfCookie(res, session.csrfToken);
    return { user, recoveryCode };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.logout(req);
    clearAuthCookies(res);
    return result;
  }

  @Get('session')
  session(@Req() req: Request) {
    return {
      user: { id: req.session?.ownerId, username: req.session?.username },
    };
  }
}
