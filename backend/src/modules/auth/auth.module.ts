import { Module } from '@nestjs/common';
import { AUTH_PROVIDER } from './auth.constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LocalAuthProvider } from './providers/local-auth.provider';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    // Swap this provider for LdapAuthProvider once phase 2 activates LDAP,
    // driven by the active mode stored in admin/settings (auth-settings.service.ts).
    { provide: AUTH_PROVIDER, useClass: LocalAuthProvider },
  ],
  exports: [AuthService],
})
export class AuthModule {}
