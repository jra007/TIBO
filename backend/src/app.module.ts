import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './modules/admin/admin.module';
import { AuditModule } from './modules/audit/audit.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { DashboardsModule } from './modules/dashboards/dashboards.module';
import { ExportsModule } from './modules/exports/exports.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PermissionsGuard } from './modules/rbac/guards/permissions.guard';
import { RbacModule } from './modules/rbac/rbac.module';
import { RelationsModule } from './modules/relations/relations.module';
import { ViewsModule } from './modules/views/views.module';

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    RbacModule,
    AuthModule,
    NotificationsModule,
    IngestionModule,
    RelationsModule,
    ViewsModule,
    DashboardsModule,
    ExportsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Order matters: JwtAuthGuard must run first to populate request.user before PermissionsGuard reads it.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
