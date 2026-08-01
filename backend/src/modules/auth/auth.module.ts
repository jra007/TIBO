import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AUTH_PROVIDER } from './auth.constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LocalAuthProvider } from './providers/local-auth.provider';

@Module({
  // AdminModule exports AuthSettingsService and LdapAuthProvider, both needed here.
  imports: [AdminModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    // Local login always stays available; LDAP is a separate opt-in endpoint (see auth.controller.ts),
    // not a mode swap — see auth-settings.service.ts for the enabled/disabled toggle.
    { provide: AUTH_PROVIDER, useClass: LocalAuthProvider },
  ],
  exports: [AuthService],
})
export class AuthModule {}
