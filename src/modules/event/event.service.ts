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
        date_time: {
          gte: startDate,
          lt: endDate,
        },
        user_id: userId,
      },
      _count: {
        id: true,
      },
    });

    return events.map((event) => ({
      date: event.date_time.toISOString().split('T')[0],
      count: event._count.id,
    }));
  }

  async getEventsByDay(date: string, userId: number): Promise<Event[]> {
    const parsed = new Date(date); // '2025-06-29' → 2025-06-29T00:00:00.000Z

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
      where: {
        date_time: {
          gte: startDate,
          lt: endDate,
        },
        user_id: userId,
      },
      include: {
        contents: true,
      },
    });
  }

  async getEventById(id: number): Promise<Event | null> {
    return this.prisma.event.findUnique({
      where: { id },
      include: {
        contents: true,
      },
    });
  }

  async createEvent(
    data: Prisma.EventCreateInput,
    userId: number,
    file?: Express.Multer.File,
  ): Promise<Event> {
    const userExists = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userExists) {
      throw new Error('User not found. Please check the userId.');
    }

    const fixedTimeSpan =
      typeof data?.time_span === 'string'
        ? parseInt(data?.time_span)
        : data?.time_span;

    if (isNaN(fixedTimeSpan)) {
      throw new BadRequestException('Invalid time_span: must be a number.');
    }

    let imageUrl: string | undefined;
    if (file) {
      imageUrl = await this.storageService.uploadFile(file);
    }

    return this.prisma.event.create({
      data: {
        ...data,
        time_span: fixedTimeSpan,
        image: imageUrl,
        user: {
          connect: { id: userId },
        },
      },
      include: {
        contents: true,
      },
    });
  }

  async updateEvent(
    id: number,
    data: Prisma.EventUpdateInput,
    file?: Express.Multer.File,
  ): Promise<Event> {
    let imageUrl: string | undefined;

    if (file) {
      imageUrl = await this.storageService.uploadFile(file);
    }

    const { contents, time_span, ...eventData } = data;

    let existingImage = null;
    if (!file) {
      const existingEvent = await this.prisma.event.findUnique({
        where: { id },
        select: { image: true },
      });
      existingImage = existingEvent?.image || null;
    }

    const updatePayload = {
      ...eventData,
      ...(typeof time_span === 'string'
        ? { time_span: parseInt(time_span, 10) }
        : { time_span }),
      image: imageUrl || existingImage,
    };

    return this.prisma.event.update({
      where: { id },
      data: updatePayload,
      include: {
        contents: true,
      },
    });
  }

  async deleteEvent(id: number): Promise<Event> {
    await this.prisma.content.deleteMany({
      where: { event_id: Number(id) },
    });

    // Now delete the event
    return this.prisma.event.delete({
      where: { id: Number(id) },
    });
  }

  async getContentsByEventId(eventId: number): Promise<Content[]> {
    return this.prisma.content.findMany({
      where: {
        event_id: Number(eventId),
      },
    });
  }

  async getContentById(
    eventId: number,
    contentId: number,
  ): Promise<Content | null> {
    // First check if the event exists
    const eventExists = await this.prisma.event.findUnique({
      where: { id: Number(eventId) },
    });

    if (!eventExists) {
      throw new NotFoundException('Event not found. Please check the eventId.');
    }

    // Now find the content associated with the event
    const content = await this.prisma.content.findUnique({
      where: {
        id: Number(contentId),
        event_id: Number(eventId), // Ensures content is linked to the specified event
      },
      include: {
        content_recipients: true, // Include associated recipients
        event: true, // Optionally include related event
      },
    });

    if (!content) {
      throw new NotFoundException('Content not found for the specified event.');
    }

    return content;
  }

  async createContent(
    eventId: number,
    data: CreateContentDto,
    userId: number,
  ): Promise<Content> {
    // Check if the event exists
    const eventExists = await this.prisma.event.findUnique({
      where: { id: Number(eventId) },
    });

    if (!eventExists) {
      throw new NotFoundException('Event not found. Please check the eventId.');
    }

    // Destructure data to separate content recipients
    const { content_recipients, post_method, ...contentData } = data;

    // Lookup the PostMethod ID based on the provided method name
    const postMethod = await this.prisma.postMethod.findUnique({
      where: { name: post_method }, // Assuming post_method is the exact method name
    });
    if (!postMethod) {
      throw new NotFoundException(`Post method "${post_method}" not found.`);
    }

    // Create the content record
    const content = await this.prisma.content.create({
      data: {
        ...contentData,
        event: { connect: { id: Number(eventId) } },
        content_recipients: content_recipients
          ? {
              create: content_recipients.map((recipient) => ({
                recipient, // Assuming recipient is directly the identifier
                method_id: postMethod.id, // Link to the found PostMethod ID
                user_id: userId,
              })),
            }
          : {}, // If no recipients are provided, create content without them
      },
    });

    const { name } = await this.prisma.event.findFirst({
      where: {
        id: Number(eventId),
      },
    });

    // If there are recipients, send an email
    if (content_recipients && content_recipients.length > 0) {
      const emailSubject = `New Content Created for the Event: ${name}`;
      const emailBody = this.emailService.createEmailBody(
        content.content_type,
        content.text_content,
        content.attachment,
      );

      // Send emails to all recipients
      await Promise.all(
        content_recipients.map((recipient) => {
          return this.emailService.sendEmail(
            recipient,
            emailSubject,
            emailBody,
          );
        }),
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
    // Ensure event exists
    const eventExists = await this.prisma.event.findUnique({
      where: { id: Number(eventId) },
    });
    if (!eventExists) {
      throw new NotFoundException('Event not found. Please check the eventId.');
    }

    // Destructure data to separate content recipients
    const { content_recipients, post_method, ...contentData } = data;

    // Prepare the content update data
    const contentUpdateData: Prisma.ContentUpdateInput = {
      ...contentData,
      content_recipients: content_recipients
        ? {
            deleteMany: { content_id: Number(id) }, // Optionally clear existing recipients
            create: await Promise.all(
              content_recipients.map(async (recipient) => {
                const postMethod = await this.prisma.postMethod.findUnique({
                  where: { name: post_method }, // Match by method name
                });
                if (!postMethod) {
                  throw new NotFoundException(
                    `Post method "${post_method}" not found.`,
                  );
                }

                return {
                  recipient,
                  user: { connect: { id: userId } },
                  post_method: { connect: { id: postMethod.id } },
                };
              }),
            ),
          }
        : undefined, // If no recipients are provided, do not update this field
    };

    // Update the content
    const updatedContent = await this.prisma.content.update({
      where: { id: Number(id) },
      data: contentUpdateData,
    });

    if (content_recipients && content_recipients.length > 0) {
      const emailSubject = `Content Updated for Event ID: ${eventId}`;
      const emailBody = this.emailService.createEmailBody(
        updatedContent.content_type,
        updatedContent.text_content,
        updatedContent.attachment,
      );
      // Send emails to all recipients
      await Promise.all(
        content_recipients.map(async (recipient) => {
          return this.emailService.sendEmail(
            recipient,
            emailSubject,
            emailBody,
          );
        }),
      );
    }

    return updatedContent;
  }

  async deleteContent(id: number, eventId: number): Promise<Content> {
    const eventExists = await this.prisma.event.findUnique({
      where: { id: Number(eventId) },
    });
    if (!eventExists) {
      throw new Error('Event not found. Please check the eventId.');
    }
    const contentId = Number(id);
    return this.prisma.content.delete({
      where: { id: contentId },
    });
  }

  async uploadContentFile(file: Express.Multer.File): Promise<string> {
    return this.storageService.uploadFile(file);
  }

  // Method to email existing content
  async emailContent(
    eventId: number,
    contentId: number,
    userEmail: string,
  ): Promise<void> {
    const content = await this.prisma.content.findUnique({
      where: { id: Number(contentId) },
      include: {
        event: true,
      },
    });

    if (!content || content.event.id !== eventId) {
      throw new Error(
        'Content not found or does not belong to the specified event.',
      );
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
      where: {
        user_id: userId,
      },
      distinct: ['recipient'],
      select: {
        recipient: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return recipients.map((r) => r.recipient);
  }

  async getAllEventsByUserId(userId: number) {
    return this.prisma.event.findMany({
      where: { user_id: userId },
      orderBy: { date_time: 'desc' },
    });
  }
}
