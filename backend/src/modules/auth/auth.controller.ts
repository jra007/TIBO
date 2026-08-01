import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from './authenticated-request';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() body: { username: string; password: string }) {
    return this.authService.login(body.username, body.password);
  }

  @Public()
  @Post('login/ldap')
  loginLdap(@Body() body: { username: string; password: string }) {
    return this.authService.loginWithLdap(body.username, body.password);
  }

  /** Powers the login page: whether to show an LDAP login form alongside the always-available local one. */
  @Public()
  @Get('methods')
  getMethods() {
    return this.authService.getAuthMethods();
  }

  @Post('change-password')
  changePassword(@Req() req: AuthenticatedRequest, @Body() body: { currentPassword: string; newPassword: string }) {
    return this.authService.changePassword(req.user.id, body.currentPassword, body.newPassword);
  }
}
