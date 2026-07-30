import { Module } from '@nestjs/common';
import { ColumnProfilerService } from './column-profiler.service';
import { RelationsController } from './relations.controller';
import { RelationsService } from './relations.service';

@Module({
  controllers: [RelationsController],
  providers: [RelationsService, ColumnProfilerService],
  exports: [RelationsService],
})
export class RelationsModule {}
