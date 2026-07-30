import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ColumnProfilerService } from './column-profiler.service';
import { RelationsController } from './relations.controller';
import { RelationsService } from './relations.service';

@Module({
  imports: [NotificationsModule],
  controllers: [RelationsController],
  providers: [RelationsService, ColumnProfilerService],
  exports: [RelationsService],
})
export class RelationsModule {}
