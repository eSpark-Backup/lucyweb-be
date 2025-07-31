import { Controller, Post, Get, Query, UseGuards } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { JwtAuthGuard } from 'src/common/guard/jwtAuth.guard';
import { Roles } from 'src/common/decorator/roles.decorator';
import { Role } from 'src/common/schema/roles.enum';

@Controller('scheduler')
@UseGuards(JwtAuthGuard)
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @Post('trigger-reminders')
  @Roles(Role.ADMIN)
  async triggerEventReminders() {
    await this.schedulerService.sendEventReminders();
    return { message: 'Event reminder check triggered successfully' };
  }

  @Get('check-events')
  @Roles(Role.ADMIN)
  async checkEventsForDate(@Query('date') date: string) {
    if (!date) {
      const fiveDaysFromNow = new Date();
      fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
      date = fiveDaysFromNow.toISOString().split('T')[0];
    }
    
    const events = await this.schedulerService.getEventsForDate(date);
    return {
      date,
      eventCount: events.length,
      events: events.map(event => ({
        id: event.id,
        name: event.name,
        date_time: event.date_time,
        contentCount: event.contents.length,
        recipientCount: event.contents.reduce((total, content) => 
          total + content.content_recipients.length, 0
        ),
      })),
    };
  }
} 