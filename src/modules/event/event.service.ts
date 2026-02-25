/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { Content, Event, Prisma, School } from '@prisma/client';
import { CreateContentDto, UpdateContentDto } from 'src/common/dto/contentDto';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { EmailService } from '../email/email.service';
import { SendReminderEmailDto } from 'src/common/dto/sentReminderEmailDto';
import { LIFETIME_SCHOOL_EMAIL } from '../payment/payment.service';
import { Readable } from 'stream';
import * as archiver from 'archiver';
import { PassThrough } from 'stream';
import * as fs from 'fs';
import * as path from 'path';

interface ContentResponse extends Content {
  content_types: Content['content_type'];
  attachments?: string[];
}

function normalizeToArray(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String);
  return [String(val)];
}

function addEventImagesToContent(
  content: Content,
  eventImages: string[] = [],
): ContentResponse {
  return {
    ...content,
    content_types: content.content_type,
    attachments: eventImages && eventImages.length > 0 ? eventImages : [],
  };
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

  async importPublicEvents(): Promise<{
    message: string;
    imported_count: number;
  }> {
    try {
      const filePath = path.join(process.cwd(), 'src/data/public_events.json');
      const rawData = fs.readFileSync(filePath, 'utf-8');
      const events = JSON.parse(rawData);

      if (!Array.isArray(events)) {
        throw new Error('Invalid JSON format: Expected an array of events');
      }

      let importedCount = 0;

      for (const event of events) {
        // Check if an event with the same name already exists
        const existingEvent = await this.prisma.event.findFirst({
          where: { name: event.name },
        });

        if (!existingEvent) {
          await this.prisma.event.create({
            data: {
              name: event.name,
              description: event.description || '',
              start_date: new Date(event.start_date),
              end_date: new Date(event.end_date),
              is_public: event.is_public ?? true,
              images: event.images || [],
              user: { connect: { id: event.user_id } },
              school: event.school_id
                ? { connect: { id: event.school_id } }
                : undefined,
            },
          });
          importedCount++;
        }
      }

      return {
        message: 'Public events imported successfully',
        imported_count: importedCount,
      };
    } catch (err) {
      throw new Error(`Failed to import public events: ${err.message}`);
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

  async getEventById(
    id: number,
    userId?: number,
  ): Promise<
    | (Event & {
        school: {
          id: number;
          name: string;
          email: string;
          is_paid: boolean;
          organization: { id: number; name: string } | null;
        } | null;
      })
    | null
  > {
    const event = await this.prisma.event.findFirst({
      where: {
        id,
        OR: [
          { is_public: true }, // public events (school can be null)
          ...(userId
            ? [{ user_id: userId }, { school: { user_id: userId } }]
            : []),
        ],
      },
      include: {
        contents: true,
        school: {
          select: {
            id: true,
            name: true,
            email: true,
            is_paid: true,
            organization: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!event) return null;

    // Ensure school is null if it doesn't exist
    if (!event.school) {
      return { ...event, school: null };
    }

    // Ensure organization is null if school exists but no organization
    if (event.school && !event.school.organization) {
      event.school.organization = null;
    }

    return event;
  }

  async createEvent(
    data: Prisma.EventCreateInput & {
      school_email?: string;
      image_url?: string;
      images_urls?: string[];
    },
    userId: number,
    files?: Express.Multer.File[],
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

    const imageUrls: string[] = [];

    // Upload files if provided
    if (files?.length) {
      const uploadedFileUrls = await Promise.all(
        files.map((file) => this.storageService.uploadFile(file)),
      );
      imageUrls.push(...uploadedFileUrls);
    }

    // Accept image URLs if provided in separate key
    if (data.images_urls && Array.isArray(data.images_urls)) {
      imageUrls.push(...data.images_urls);
    } else if (data.images_urls && typeof data.images_urls === 'string') {
      // support single URL as string
      imageUrls.push(data.images_urls);
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

    const { school_email, image_url, images_urls, ...rest } = data;

    return this.prisma.event.create({
      data: {
        ...rest,
        start_date: startDate,
        end_date: endDate,
        images: imageUrls,
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
      images_urls?: string[];
      images_files?: Express.Multer.File[];
    },
    userId?: number,
    files?: Express.Multer.File[],
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
    // Handle image upload / URL
    let imageUrls: string[] = [];

    // Upload files if provided
    if (files?.length) {
      const uploadedFileUrls = await Promise.all(
        files.map((file) => this.storageService.uploadFile(file)),
      );
      imageUrls.push(...uploadedFileUrls);
    }

    // Accept image URLs if provided in separate key
    if (data.images_urls && Array.isArray(data.images_urls)) {
      imageUrls.push(...data.images_urls);
    } else if (data.images_urls && typeof data.images_urls === 'string') {
      imageUrls.push(data.images_urls);
    }

    // If no files or URLs provided → keep existing images
    if (!imageUrls.length) {
      const existingEvent = await this.prisma.event.findUnique({
        where: { id },
        select: { images: true },
      });
      imageUrls = existingEvent?.images ?? [];
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
    if (!files?.length && !data.images) {
      const existingEvent = await this.prisma.event.findUnique({
        where: { id },
        select: { images: true },
      });
      existingImage = existingEvent?.images?.[0] || null;
    }

    const {
      contents,
      school_email,
      images,
      images_urls,
      images_files,
      ...eventData
    } = data;

    const updatePayload: Prisma.EventUpdateInput = {
      ...eventData,
      images: imageUrls,
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

  // ✅ Updated to return content_types and attachments with event images
  async getContentsByEventId(eventId: number): Promise<ContentResponse[]> {
    const event = await this.prisma.event.findUnique({
      where: { id: Number(eventId) },
      select: { images: true },
    });

    if (!event) {
      throw new NotFoundException('Event not found.');
    }

    const contents = await this.prisma.content.findMany({
      where: { event_id: Number(eventId) },
      include: { event: true },
    });

    const eventImages = event.images || [];

    return contents.map((c) => ({
      ...addEventImagesToContent(c, eventImages),
      text_content: normalizeToArray(c.text_content).map(
        (t) => `${c.event.name}: ${t}`,
      ),
    }));
  }

  async getContentById(
    eventId: number,
    contentId: number,
  ): Promise<ContentResponse | null> {
    const event = await this.prisma.event.findUnique({
      where: { id: Number(eventId) },
      select: { images: true },
    });

    if (!event) throw new NotFoundException('Event not found.');

    const content = await this.prisma.content.findUnique({
      where: { id: Number(contentId) },
      include: { content_recipients: true, event: true },
    });

    if (!content || content.event.id !== eventId) {
      throw new NotFoundException('Content not found for this event.');
    }

    return addEventImagesToContent(content, event.images || []);
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
      const eventImages =
        event.images && event.images.length > 0 ? event.images : undefined;

      const emailBody = this.emailService.createEmailBody(
        normalizeToArray(content.content_type),
        normalizeToArray(content.text_content),
        content.attachment ?? null,
        eventImages,
      );

      await Promise.all(
        content_recipients.map((recipient) =>
          this.emailService.sendEmail(recipient, emailSubject, emailBody),
        ),
      );
    }

    return addEventImagesToContent(content, event.images || []);
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
      const eventImages =
        event.images && event.images.length > 0 ? event.images : undefined;

      const emailBody = this.emailService.createEmailBody(
        normalizeToArray(updatedContent.content_type),
        normalizeToArray(updatedContent.text_content),
        updatedContent.attachment ?? null,
        eventImages,
      );

      await Promise.all(
        content_recipients.map((recipient) =>
          this.emailService.sendEmail(recipient, emailSubject, emailBody),
        ),
      );
    }

    return addEventImagesToContent(updatedContent, event.images || []);
  }

  async deleteContent(
    id: number,
    eventId: number,
  ): Promise<{ message: string; data: ContentResponse }> {
    const event = await this.prisma.event.findUnique({
      where: { id: Number(eventId) },
      select: { images: true },
    });

    if (!event) {
      throw new NotFoundException('Event not found.');
    }

    const deletedContent = await this.prisma.content.delete({
      where: { id: Number(id) },
    });

    return {
      message: 'Content deleted successfully',
      data: addEventImagesToContent(deletedContent, event.images || []),
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
    const eventImages =
      content.event.images && content.event.images.length > 0
        ? content.event.images
        : undefined;

    const emailBody = this.emailService.createEmailBody(
      normalizeToArray(content.content_type),
      normalizeToArray(content.text_content),
      content.attachment ?? null,
      eventImages,
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

    const publicEvents = await this.prisma.event.findMany({
      where: { is_public: true },
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

    const userEvents = await this.prisma.event.findMany({
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

    return {
      user_events: userEvents,
      public_events: publicEvents,
    };
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
    const eventImages =
      event.images && event.images.length > 0 ? event.images : undefined;

    const emailBody = this.emailService.createEmailBody(
      normalizeToArray(content_type),
      normalizeToArray(text_content),
      attachment ?? null,
      eventImages,
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

  async downloadSingleFile(
    fileUrl: string,
  ): Promise<{ stream: Readable; filename: string }> {
    if (!fileUrl) {
      throw new BadRequestException('File URL is required');
    }

    let fileStream: Readable;
    let filename: string;

    if (this.storageService.isS3Url(fileUrl)) {
      const fileKey = this.storageService.extractKeyFromUrl(fileUrl);
      if (!fileKey) {
        throw new BadRequestException('Invalid S3 URL');
      }

      fileStream = await this.storageService.getFileStream(fileKey);
      filename = fileKey;
    } else {
      fileStream = await this.storageService.downloadExternalFile(fileUrl);
      filename = this.storageService.extractFilenameFromUrl(fileUrl);
    }

    return { stream: fileStream, filename };
  }
  async downloadMultipleFilesAsZip(fileUrls: string[]): Promise<PassThrough> {
    if (!fileUrls || !fileUrls.length) {
      throw new BadRequestException('fileUrls array cannot be empty');
    }

    const zipStream = new PassThrough();
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err: Error) => {
      console.error('Archive error:', err);
      zipStream.destroy(err);
    });

    zipStream.on('error', (err) => {
      console.error('Zip stream error:', err);
      archive.destroy();
    });

    archive.pipe(zipStream);

    (async () => {
      for (const fileUrl of fileUrls) {
        if (!fileUrl) continue;

        try {
          let fileStream: Readable;
          let filename: string;

          // Check if it's an S3 URL
          if (this.storageService.isS3Url(fileUrl)) {
            const fileKey = this.storageService.extractKeyFromUrl(fileUrl);
            if (!fileKey) {
              console.warn(`Invalid S3 URL: ${fileUrl}`);
              continue;
            }
            fileStream = await this.storageService.getFileStream(fileKey);
            filename = fileKey;
          } else {
            // Download from external URL
            fileStream =
              await this.storageService.downloadExternalFile(fileUrl);
            filename = this.storageService.extractFilenameFromUrl(fileUrl);
          }

          archive.append(fileStream, { name: filename });
        } catch (err) {
          console.error(`Failed to add file ${fileUrl} to ZIP:`, err);
          // Continue with next file instead of failing
        }
      }

      archive.finalize(); // finalize AFTER all append calls
    })().catch((err) => {
      console.error('Error processing files for ZIP:', err);
      zipStream.destroy(err);
    });

    return zipStream;
  }

  // EventService
  async seedPublicAwarenessEvents(): Promise<{
    message: string;
    count: number;
  }> {
    const events = [
      {
        id: 1,
        name: 'EVENT_NAME_1',
        type: null,
        start_date: new Date('YYYY-MM-DD'),
        end_date: new Date('YYYY-MM-DD'),
        description: 'DESCRIPTION_1',
        user_id: 1, // system user
        school_id: null,
        images: ['IMAGE_URL_1', 'IMAGE_URL_2'],
        contents: [],
        is_public: true,
      },
      {
        id: 2,
        name: 'EVENT_NAME_2',
        type: null,
        start_date: new Date('YYYY-MM-DD'),
        end_date: new Date('YYYY-MM-DD'),
        description: 'DESCRIPTION_2',
        user_id: 1,
        school_id: null,
        images: ['IMAGE_URL_1', 'IMAGE_URL_2'],
        contents: [],
        is_public: true,
      },
      // Add more events here
    ];

    const result = await this.prisma.event.createMany({
      data: events,
      skipDuplicates: true,
    });

    return {
      message: 'Public awareness events seeded successfully',
      count: result.count,
    };
  }
}
