/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Content, Event, Prisma } from '@prisma/client';
import { CreateContentDto, UpdateContentDto } from 'src/common/dto/contentDto';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { EmailService } from '../email/email.service';
import { SendReminderEmailDto } from 'src/common/dto/sentReminderEmailDto';

@Injectable()
export class EventService {
  constructor(
    private prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly emailService: EmailService,
  ) {}

  async getEventCountByDay(
    year: number,
    month: number,
    userId: number,
  ): Promise<{ date: string; count: number }[]> {
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 1));

    const events = await this.prisma.event.groupBy({
      by: ['date_time'],
      where: {
        date_time: { gte: startDate, lt: endDate },
        user_id: userId,
      },
      _count: { id: true },
    });

    return events.map((event) => ({
      date: event.date_time.toISOString().split('T')[0],
      count: event._count.id,
    }));
  }

  async getEventsByDay(date: string, userId: number): Promise<Event[]> {
    const parsed = new Date(date);
    const startDate = new Date(
      Date.UTC(
        parsed.getUTCFullYear(),
        parsed.getUTCMonth(),
        parsed.getUTCDate(),
      ),
    );
    const endDate = new Date(
      Date.UTC(
        parsed.getUTCFullYear(),
        parsed.getUTCMonth(),
        parsed.getUTCDate() + 1,
      ),
    );

    return this.prisma.event.findMany({
      where: { date_time: { gte: startDate, lt: endDate }, user_id: userId },
      include: {
        contents: true,
        school: {
          select: {
            id: true,
            name: true,
            email: true,
            is_paid: true,
          },
        },
      },
    });
  }

  async getEventById(id: number): Promise<Event | null> {
    return this.prisma.event.findUnique({
      where: { id },
      include: {
        contents: true,
        school: {
          select: {
            id: true,
            name: true,
            email: true,
            is_paid: true,
            organization: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  async createEvent(
    data: Prisma.EventCreateInput & { school_email?: string },
    userId: number,
    file?: Express.Multer.File,
  ): Promise<Event> {
    // Ensure the user exists and include linked school
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { school: true },
    });
    if (!user) throw new BadRequestException('User not found');

    // Validate and normalize event date
    const eventDate = new Date(data.date_time);
    if (isNaN(eventDate.getTime())) {
      throw new BadRequestException('Invalid date_time format');
    }
    if (eventDate.getTime() < Date.now()) {
      throw new BadRequestException('Cannot create events in the past');
    }

    // Validate/convert time_span
    const fixedTimeSpan =
      typeof (data as any).time_span === 'string'
        ? parseInt((data as any).time_span, 10)
        : (data as any).time_span;
    if (isNaN(fixedTimeSpan)) {
      throw new BadRequestException('Invalid time_span: must be a number');
    }

    // Optional image upload
    let imageUrl: string | undefined;
    if (file) {
      imageUrl = await this.storageService.uploadFile(file);
    }

    // Determine school association strictly by email or fallback to user's own school
    let schoolToConnect: { id: number } | undefined;

    if (data.school_email) {
      const school = await this.prisma.school.findUnique({
        where: { email: data.school_email },
      });
      if (!school) {
        throw new BadRequestException(
          `School with email ${data.school_email} not found`,
        );
      }
      schoolToConnect = { id: school.id };
    } else if (user.school) {
      schoolToConnect = { id: user.school.id };
    }

    if (!schoolToConnect) {
      throw new BadRequestException(
        'school_email must be provided for trust users or the user must be linked to a school',
      );
    }

    const { school_email, ...rest } = data;

    return this.prisma.event.create({
      data: {
        ...rest,
        date_time: eventDate,
        time_span: fixedTimeSpan,
        image: imageUrl,
        user: { connect: { id: userId } },
        school: { connect: schoolToConnect },
      },
      include: {
        contents: true,
        school: {
          select: {
            id: true,
            name: true,
            email: true,
            is_paid: true,
          },
        },
      },
    });
  }

  async updateEvent(
    id: number,
    data: Prisma.EventUpdateInput & { school_email?: string | null },
    userId?: number, // optional, pass logged-in user's ID
    file?: Express.Multer.File,
  ): Promise<Event> {
    // ✅ Validate date_time if provided
    if (data.date_time) {
      const eventDate = new Date(data.date_time as string);
      if (isNaN(eventDate.getTime())) {
        throw new BadRequestException('Invalid date_time format.');
      }
      if (eventDate.getTime() < Date.now()) {
        throw new BadRequestException(
          'Cannot set event date/time in the past.',
        );
      }
      data.date_time = new Date(eventDate.getTime());
    }

    // ✅ Handle image upload
    let imageUrl: string | undefined;
    if (file) imageUrl = await this.storageService.uploadFile(file);

    // ✅ Determine school by email or fallback to logged-in user's school
    let schoolToConnect: { id: number } | undefined;
    if (data.school_email) {
      const school = await this.prisma.school.findUnique({
        where: { email: data.school_email },
      });
      if (!school) {
        throw new BadRequestException(
          `School with email ${data.school_email} not found.`,
        );
      }
      schoolToConnect = { id: school.id };
    } else if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { school: true },
      });
      if (user?.school) {
        schoolToConnect = { id: user.school.id };
      }
    }

    // ✅ Keep existing image if none uploaded
    let existingImage: string | null = null;
    if (!file) {
      const existingEvent = await this.prisma.event.findUnique({
        where: { id },
        select: { image: true },
      });
      existingImage = existingEvent?.image || null;
    }

    const { contents, time_span, school_email, ...eventData } = data;

    const updatePayload: Prisma.EventUpdateInput = {
      ...eventData,
      ...(typeof time_span === 'string'
        ? { time_span: parseInt(time_span, 10) }
        : { time_span }),
      image: imageUrl || existingImage,
      ...(schoolToConnect ? { school: { connect: schoolToConnect } } : {}), // school is updated only if determined above
    };

    return this.prisma.event.update({
      where: { id },
      data: updatePayload,
      include: {
        contents: true,
        school: {
          select: {
            id: true,
            name: true,
            email: true,
            is_paid: true,
          },
        },
      },
    });
  }

  async deleteEvent(id: number): Promise<{ message: string; data: Event }> {
    await this.prisma.content.deleteMany({
      where: { event_id: Number(id) },
    });

    const deletedEvent = await this.prisma.event.delete({
      where: { id: Number(id) },
    });

    return {
      message: 'Event deleted successfully',
      data: deletedEvent,
    };
  }

  async getContentsByEventId(eventId: number): Promise<Content[]> {
    return this.prisma.content.findMany({
      where: { event_id: Number(eventId) },
    });
  }

  async getContentById(
    eventId: number,
    contentId: number,
  ): Promise<Content | null> {
    const eventExists = await this.prisma.event.findUnique({
      where: { id: Number(eventId) },
    });
    if (!eventExists) throw new NotFoundException('Event not found.');

    const content = await this.prisma.content.findUnique({
      where: { id: Number(contentId) },
      include: { content_recipients: true, event: true },
    });

    if (!content || content.event.id !== eventId) {
      throw new NotFoundException('Content not found for this event.');
    }
    return content;
  }

  async createContent(
    eventId: number,
    data: CreateContentDto,
    userId: number,
  ): Promise<Content> {
    const eventExists = await this.prisma.event.findUnique({
      where: { id: Number(eventId) },
    });
    if (!eventExists) throw new NotFoundException('Event not found.');

    const { content_recipients, post_method, ...contentData } = data;

    const postMethod = await this.prisma.postMethod.findUnique({
      where: { name: post_method },
    });
    if (!postMethod)
      throw new NotFoundException(`Post method "${post_method}" not found.`);

    const content = await this.prisma.content.create({
      data: {
        ...contentData,
        event: { connect: { id: Number(eventId) } },
        content_recipients: content_recipients
          ? {
              create: content_recipients.map((recipient) => ({
                recipient,
                method_id: postMethod.id,
                user_id: userId,
              })),
            }
          : {},
      },
    });

    const { name } = await this.prisma.event.findFirst({
      where: { id: Number(eventId) },
    });
    if (content_recipients?.length) {
      const emailSubject = `New Content Created for Event: ${name}`;
      const emailBody = this.emailService.createEmailBody(
        content.content_type,
        content.text_content,
        content.attachment,
      );
      await Promise.all(
        content_recipients.map((recipient) =>
          this.emailService.sendEmail(recipient, emailSubject, emailBody),
        ),
      );
    }
    return content;
  }

  async updateContent(
    id: number,
    eventId: number,
    data: UpdateContentDto,
    userId: number,
  ): Promise<Content> {
    const eventExists = await this.prisma.event.findUnique({
      where: { id: Number(eventId) },
    });
    if (!eventExists) throw new NotFoundException('Event not found.');

    const { content_recipients, post_method, ...contentData } = data;

    const contentUpdateData: Prisma.ContentUpdateInput = {
      ...contentData,
      content_recipients: content_recipients
        ? {
            deleteMany: { content_id: Number(id) },
            create: await Promise.all(
              content_recipients.map(async (recipient) => {
                const postMethod = await this.prisma.postMethod.findUnique({
                  where: { name: post_method },
                });
                if (!postMethod)
                  throw new NotFoundException(
                    `Post method "${post_method}" not found.`,
                  );

                return {
                  recipient,
                  user: { connect: { id: userId } },
                  post_method: { connect: { id: postMethod.id } },
                };
              }),
            ),
          }
        : undefined,
    };

    const updatedContent = await this.prisma.content.update({
      where: { id: Number(id) },
      data: contentUpdateData,
    });

    if (content_recipients?.length) {
      const emailSubject = `Content Updated for Event ID: ${eventId}`;
      const emailBody = this.emailService.createEmailBody(
        updatedContent.content_type,
        updatedContent.text_content,
        updatedContent.attachment,
      );
      await Promise.all(
        content_recipients.map((recipient) =>
          this.emailService.sendEmail(recipient, emailSubject, emailBody),
        ),
      );
    }
    return updatedContent;
  }

  async deleteContent(
    id: number,
    eventId: number,
  ): Promise<{ message: string; data: Content }> {
    const eventExists = await this.prisma.event.findUnique({
      where: { id: Number(eventId) },
    });
    if (!eventExists) throw new Error('Event not found.');

    const deletedContent = await this.prisma.content.delete({
      where: { id: Number(id) },
    });

    return {
      message: 'Content deleted successfully',
      data: deletedContent,
    };
  }

  async uploadContentFile(file: Express.Multer.File): Promise<string> {
    return this.storageService.uploadFile(file);
  }

  async emailContent(
    eventId: number,
    contentId: number,
    userEmail: string,
  ): Promise<void> {
    const content = await this.prisma.content.findUnique({
      where: { id: Number(contentId) },
      include: { event: true },
    });

    if (!content || content.event.id !== eventId) {
      throw new Error('Content not found or does not belong to this event.');
    }

    const emailSubject = `Content from Event ID: ${eventId}`;
    const emailBody = `
      <h1>Content Information</h1>
      <p>Title: ${content.content_type}</p>
      <p>Text: ${content.text_content}</p>
      <p>Attachment: ${content.attachment || 'No attachment'}</p>
    `;
    await this.emailService.sendEmail(userEmail, emailSubject, emailBody);
  }

  async getAllUniqueRecipientsByUser(userId: number): Promise<string[]> {
    const recipients = await this.prisma.contentRecipient.findMany({
      where: { user_id: userId },
      distinct: ['recipient'],
      select: { recipient: true },
      orderBy: { created_at: 'desc' },
    });
    return recipients.map((r) => r.recipient);
  }

  async getAllEventsByUserId(userId: number) {
    return this.prisma.event.findMany({
      where: { user_id: userId },
      orderBy: { date_time: 'desc' },
      include: {
        // ✅ Include all related contents for each event
        contents: true,
        school: {
          select: {
            id: true,
            name: true,
            email: true,
            is_paid: true,
          },
        },
      },
    });
  }

  async sendEmailToRecipients(
    eventId: number,
    data: SendReminderEmailDto,
  ): Promise<{ success: boolean }> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) throw new NotFoundException('Event not found');

    const { content_recipients, content_type, text_content, attachment } = data;
    if (!content_recipients?.length) {
      throw new BadRequestException('Recipients list cannot be empty');
    }

    const emailSubject = `Reminder: Upcoming Event - ${event.name}`;
    const emailBody = this.emailService.createEmailBody(
      content_type,
      text_content,
      attachment ?? null,
    );

    await Promise.all(
      content_recipients.map((recipient) =>
        this.emailService.sendEmail(recipient, emailSubject, emailBody),
      ),
    );
    return { success: true };
  }
}
