import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@Query('recipientUserId') recipientUserId: string) {
    return this.notificationsService.listFor(recipientUserId);
  }

  @Post(':id/read')
  markRead(@Param('id') id: string) {
    return this.notificationsService.markRead(id);
  }
}
