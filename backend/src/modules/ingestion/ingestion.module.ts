import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { RelationsModule } from '../relations/relations.module';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';

@Module({
  imports: [RelationsModule, NotificationsModule],
  controllers: [IngestionController],
  providers: [IngestionService],
  exports: [IngestionService],
})
export class IngestionModule {}
