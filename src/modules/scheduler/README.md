# Scheduler Module

This module handles automated scheduled tasks for the application.

## Features

### Event Reminders
- **Automatic Daily Check**: Runs every day at 9:00 AM
- **5-Day Advance Notice**: Sends reminder emails to all content recipients 5 days before an event
- **Comprehensive Email**: Includes event details and all associated content

## How It Works

1. **Daily Cron Job**: The scheduler runs automatically every day at 9:00 AM
2. **Event Detection**: Queries the database for events happening exactly 5 days from the current date
3. **Recipient Collection**: Gathers all unique email recipients from all content associated with each event
4. **Email Sending**: Sends personalized reminder emails to all recipients

## Email Content

The reminder emails include:
- Event name, date, and time
- Event description (if available)
- All content associated with the event
- Professional styling with event branding

## Manual Trigger

For testing purposes, administrators can manually trigger the reminder check:

```
POST /dev/api/v1/scheduler/trigger-reminders
```

**Requirements:**
- JWT Authentication
- Admin role

## Check Events

Check which events are scheduled for a specific date:

```
GET /dev/api/v1/scheduler/check-events?date=2024-01-15
```

**Parameters:**
- `date` (optional): Date in YYYY-MM-DD format. If not provided, defaults to 5 days from now.

**Response:**
```json
{
  "date": "2024-01-15",
  "eventCount": 2,
  "events": [
    {
      "id": 1,
      "name": "School Meeting",
      "date_time": "2024-01-15T10:00:00.000Z",
      "contentCount": 3,
      "recipientCount": 15
    }
  ]
}
```

## Configuration

The cron schedule can be modified in `scheduler.service.ts`:

```typescript
@Cron(CronExpression.EVERY_DAY_AT_9AM)
```

Available options:
- `EVERY_DAY_AT_9AM` - Daily at 9:00 AM
- `EVERY_DAY_AT_MIDNIGHT` - Daily at midnight
- `EVERY_HOUR` - Every hour
- Custom cron expressions

## Logging

The service provides comprehensive logging:
- Start/completion of daily checks
- Number of events found
- Success/failure of email sending
- Error details for troubleshooting

## Dependencies

- `@nestjs/schedule` - For cron job functionality
- `PrismaService` - For database queries
- `EmailService` - For sending emails 