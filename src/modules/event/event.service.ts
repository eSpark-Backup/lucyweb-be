/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { Content, Event, Prisma } from '@prisma/client';
import { CreateContentDto, UpdateContentDto } from 'src/common/dto/contentDto';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { EmailService } from '../email/email.service';
import { SendReminderEmailDto } from 'src/common/dto/sentReminderEmailDto';
import { LIFETIME_SCHOOL_EMAIL } from '../payment/payment.service';

interface ContentResponse extends Content {
  content_types: Content['content_type'];
}

function normalizeToArray(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String);
  return [String(val)];
}

@Injectable()
export class EventService {
  constructor(
    private prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly emailService: EmailService,
  ) {}

  private checkSchoolAccess(school: {
    email: string;
    is_paid: boolean;
    subscription_end: Date | null;
  }) {
    if (
      school.email !== LIFETIME_SCHOOL_EMAIL &&
      (!school.is_paid ||
        (school.subscription_end && school.subscription_end < new Date()))
    ) {
      throw new ForbiddenException('Subscription expired');
    }
  }

  async getEventCountByDay(
    year: number,
    month: number,
    userId: number,
  ): Promise<{ date: string; count: number }[]> {
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 1));

    const events = await this.prisma.event.groupBy({
      by: ['start_date'],
      where: {
        start_date: { gte: startDate, lt: endDate },
        user_id: userId,
      },
      _count: { id: true },
    });

    return events.map((event) => ({
      date: event.start_date.toISOString().split('T')[0],
      count: event._count.id,
    }));
  }

  async getEventsByDay(date: string, userId: number): Promise<Event[]> {
    const parsed = new Date(date);
    const startOfDay = new Date(
      Date.UTC(
        parsed.getUTCFullYear(),
        parsed.getUTCMonth(),
        parsed.getUTCDate(),
      ),
    );
    const endOfDay = new Date(
      Date.UTC(
        parsed.getUTCFullYear(),
        parsed.getUTCMonth(),
        parsed.getUTCDate() + 1,
      ),
    );

    return this.prisma.event.findMany({
      where: {
        user_id: userId,
        start_date: { lte: endOfDay },
        end_date: { gte: startOfDay },
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
    data: Prisma.EventCreateInput & {
      school_email?: string;
      image_url?: string;
    },
    userId: number,
    file?: Express.Multer.File | string,
  ): Promise<Event> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { school: true },
    });
    if (!user) throw new BadRequestException('User not found');

    const startDate = new Date(data.start_date as string);
    const endDate = new Date(data.end_date as string);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid date format');
    }
    if (startDate.getTime() < Date.now()) {
      throw new BadRequestException('Cannot create events in the past');
    }
    if (startDate.getTime() > endDate.getTime()) {
      throw new BadRequestException(
        'Start date must be before or equal to end date',
      );
    }

    let imageUrl: string | undefined;

    // Accept file upload
    if (file && typeof file !== 'string') {
      // file is an actual uploaded file
      imageUrl = await this.storageService.uploadFile(file);
    } else if (file && typeof file === 'string') {
      // file is a string (URL) sent under same key
      imageUrl = file;
    } else if (data.image_url) {
      // fallback to image_url in data
      imageUrl = data.image_url;
    }

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

    const existingEvent = await this.prisma.event.findFirst({
      where: {
        name: data.name,
        school_id: schoolToConnect?.id,
      },
    });
    if (existingEvent) {
      throw new BadRequestException(
        `Event with name "${data.name}" already exists.`,
      );
    }

    if (!schoolToConnect) {
      throw new BadRequestException(
        'school_email must be provided for trust users or the user must be linked to a school',
      );
    }

    const { school_email, image_url, ...rest } = data;

    return this.prisma.event.create({
      data: {
        ...rest,
        start_date: startDate,
        end_date: endDate,
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
    data: Prisma.EventUpdateInput & {
      school_email?: string | null;
      image_url?: string;
    },
    userId?: number,
    file?: Express.Multer.File | string,
  ): Promise<Event> {
    // Validate and normalize dates
    if (data.start_date || data.end_date) {
      const startDate = data.start_date
        ? new Date(data.start_date as string)
        : null;
      const endDate = data.end_date ? new Date(data.end_date as string) : null;

      if (startDate && isNaN(startDate.getTime())) {
        throw new BadRequestException('Invalid start_date format.');
      }
      if (endDate && isNaN(endDate.getTime())) {
        throw new BadRequestException('Invalid end_date format.');
      }

      // Get current dates if not updating
      const currentEvent = await this.prisma.event.findUnique({
        where: { id },
        select: { start_date: true, end_date: true },
      });
      const finalStartDate = startDate || currentEvent?.start_date;
      const finalEndDate = endDate || currentEvent?.end_date;

      if (finalStartDate && finalStartDate.getTime() < Date.now()) {
        throw new BadRequestException(
          'Cannot set event start date in the past.',
        );
      }
      if (
        finalStartDate &&
        finalEndDate &&
        finalStartDate.getTime() > finalEndDate.getTime()
      ) {
        throw new BadRequestException(
          'Start date must be before or equal to end date.',
        );
      }

      if (startDate) data.start_date = startDate;
      if (endDate) data.end_date = endDate;
    }

    // Handle image upload / URL
    let imageUrl: string | undefined;
    if (file) {
      imageUrl =
        typeof file === 'string'
          ? file
          : await this.storageService.uploadFile(file);
    } else if (data.image_url) {
      imageUrl = data.image_url;
    } else {
      const existingEvent = await this.prisma.event.findUnique({
        where: { id },
        select: { image: true },
      });
      imageUrl = existingEvent?.image || undefined;
    }

    // Determine the school for this event
    let schoolToConnect: { id: number } | undefined;
    if (data.school_email) {
      const school = await this.prisma.school.findUnique({
        where: { email: data.school_email },
      });
      if (!school)
        throw new BadRequestException(
          `School with email ${data.school_email} not found.`,
        );
      schoolToConnect = { id: school.id };
    } else if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { school: true },
      });
      if (user?.school) schoolToConnect = { id: user.school.id };
    }

    if (!schoolToConnect) {
      const existingEvent = await this.prisma.event.findUnique({
        where: { id },
        select: { school_id: true },
      });

      if (!existingEvent?.school_id) {
        throw new BadRequestException('Event school not found');
      }

      schoolToConnect = { id: existingEvent.school_id };
    }

    // Check for duplicate event name **only within the same school**
    if (data.name && schoolToConnect) {
      const existingEvent = await this.prisma.event.findFirst({
        where: {
          name: data.name as string,
          school_id: schoolToConnect.id,
          id: { not: id }, // exclude current event
        },
      });
      if (existingEvent) {
        throw new BadRequestException(
          `Another event with name "${data.name}" already exists in this school.`,
        );
      }
    }

    // Keep existing image if no new file provided
    let existingImage: string | null = null;
    if (!file) {
      const existingEvent = await this.prisma.event.findUnique({
        where: { id },
        select: { image: true },
      });
      existingImage = existingEvent?.image || null;
    }

    const { contents, school_email, image_url, ...eventData } = data;

    const updatePayload: Prisma.EventUpdateInput = {
      ...eventData,
      image: imageUrl || existingImage,
      ...(schoolToConnect ? { school: { connect: schoolToConnect } } : {}),
    };

    return this.prisma.event.update({
      where: { id },
      data: updatePayload,
      include: {
        contents: true,
        school: {
          select: { id: true, name: true, email: true, is_paid: true },
        },
      },
    });
  }

  async deleteEvent(id: number): Promise<{ message: string; data: Event }> {
    await this.prisma.content.deleteMany({ where: { event_id: Number(id) } });
    const deletedEvent = await this.prisma.event.delete({
      where: { id: Number(id) },
    });
    return { message: 'Event deleted successfully', data: deletedEvent };
  }

  // ✅ Updated to return content_types
  async getContentsByEventId(eventId: number): Promise<ContentResponse[]> {
    const contents = await this.prisma.content.findMany({
      where: { event_id: Number(eventId) },
    });
    return contents.map((c) => ({ ...c, content_types: c.content_type }));
  }

  async getContentById(
    eventId: number,
    contentId: number,
  ): Promise<ContentResponse | null> {
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
    return { ...content, content_types: content.content_type };
  }

  async createContent(
    eventId: number,
    data: CreateContentDto,
    userId: number,
  ): Promise<ContentResponse> {
    const event = await this.prisma.event.findUnique({
      where: { id: Number(eventId) },
    });
    if (!event) throw new NotFoundException('Event not found.');

    const {
      content_recipients,
      post_method,
      content_types,
      text_content,
      attachment,
    } = data;

    // Prepend event name to each text content item
    const modifiedTextContent = text_content.map(
      (text) => `${event.name}: ${text}`,
    );

    const postMethod = await this.prisma.postMethod.findUnique({
      where: { name: post_method },
    });
    if (!postMethod) {
      throw new NotFoundException(`Post method "${post_method}" not found.`);
    }

    const content = await this.prisma.content.create({
      data: {
        content_type: content_types,
        text_content: modifiedTextContent,
        attachment: attachment ?? null,
        event: { connect: { id: Number(eventId) } },
        content_recipients: content_recipients?.length
          ? {
              create: content_recipients.map((recipient) => ({
                recipient,
                method_id: postMethod.id,
                user_id: userId,
              })),
            }
          : undefined,
      },
    });

    if (content_recipients?.length) {
      const emailSubject = `New Content Created for Event: ${event.name}`;
      const emailBody = this.emailService.createEmailBody(
        normalizeToArray(content.content_type),
        normalizeToArray(content.text_content),
        content.attachment ?? null,
      );

      await Promise.all(
        content_recipients.map((recipient) =>
          this.emailService.sendEmail(recipient, emailSubject, emailBody),
        ),
      );
    }

    return { ...content, content_types: content.content_type };
  }

  async updateContent(
    id: number,
    eventId: number,
    data: UpdateContentDto,
    userId: number,
  ): Promise<ContentResponse> {
    const event = await this.prisma.event.findUnique({
      where: { id: Number(eventId) },
    });
    if (!event) throw new NotFoundException('Event not found.');

    const {
      content_recipients,
      post_method,
      content_types,
      text_content,
      attachment,
    } = data;

    // If text_content is provided, prepend event name to each item
    const modifiedTextContent =
      text_content !== undefined
        ? text_content.map((text) => `${event.name}: ${text}`)
        : undefined;

    const contentUpdateData: Prisma.ContentUpdateInput = {
      ...(content_types && { content_type: content_types }),
      ...(modifiedTextContent !== undefined && {
        text_content: modifiedTextContent,
      }),
      ...(attachment !== undefined && { attachment }),
      content_recipients: content_recipients?.length
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
      const emailSubject = `Content Updated for Event: ${event.name}`;
      const emailBody = this.emailService.createEmailBody(
        normalizeToArray(updatedContent.content_type),
        normalizeToArray(updatedContent.text_content),
        updatedContent.attachment ?? null,
      );

      await Promise.all(
        content_recipients.map((recipient) =>
          this.emailService.sendEmail(recipient, emailSubject, emailBody),
        ),
      );
    }

    return { ...updatedContent, content_types: updatedContent.content_type };
  }

  async deleteContent(
    id: number,
    eventId: number,
  ): Promise<{ message: string; data: ContentResponse }> {
    const eventExists = await this.prisma.event.findUnique({
      where: { id: Number(eventId) },
    });
    if (!eventExists) throw new Error('Event not found.');

    const deletedContent = await this.prisma.content.delete({
      where: { id: Number(id) },
    });

    return {
      message: 'Content deleted successfully',
      data: { ...deletedContent, content_types: deletedContent.content_type },
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

    if (!content || content.event.id !== Number(eventId)) {
      throw new NotFoundException(
        'Content not found or does not belong to this event.',
      );
    }

    const emailSubject = `Content from Event: ${content.event.name}`;
    const emailBody = this.emailService.createEmailBody(
      normalizeToArray(content.content_type),
      normalizeToArray(content.text_content),
      content.attachment ?? null,
    );

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
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { school: true },
    });

    const orConditions: any[] = [{ user_id: userId }];
    if (user?.school?.id) {
      orConditions.push({ school_id: user.school.id });
    }

    return this.prisma.event.findMany({
      where: { OR: orConditions },
      orderBy: { start_date: 'desc' },
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

  async sendEmailToRecipients(
    eventId: number,
    data: SendReminderEmailDto,
  ): Promise<{ success: boolean }> {
    const event = await this.prisma.event.findUnique({
      where: { id: Number(eventId) },
    });
    if (!event) throw new NotFoundException('Event not found');

    const { content_recipients, content_type, text_content, attachment } = data;

    if (
      !content_recipients ||
      !Array.isArray(content_recipients) ||
      !content_recipients.length
    ) {
      throw new BadRequestException('Recipients list cannot be empty');
    }

    const emailSubject = `Reminder: Upcoming Event - ${event.name}`;
    const emailBody = this.emailService.createEmailBody(
      normalizeToArray(content_type),
      normalizeToArray(text_content),
      attachment ?? null,
    );

    await Promise.all(
      content_recipients.map((recipient) =>
        this.emailService.sendEmail(recipient, emailSubject, emailBody),
      ),
    );

    return { success: true };
  }

  async searchImages(
    query: string,
    perPage?: string,
    page?: string,
  ): Promise<any> {
    if (!process.env.PEXELS_API_KEY) {
      throw new Error('PEXELS_API_KEY is not set in environment variables');
    }

    // Default values if not provided
    const per_page = perPage ? parseInt(perPage, 10) : 15;
    const pageNumber = page ? parseInt(page, 10) : 1;

    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${per_page}&page=${pageNumber}`;

    const response = await fetch(url, {
      headers: {
        Authorization: process.env.PEXELS_API_KEY,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to fetch images from Pexels: ${text}`);
    }

    return response.json();
  }
}
