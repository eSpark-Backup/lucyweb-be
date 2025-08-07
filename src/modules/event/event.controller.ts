import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guard/jwtAuth.guard';
import { EventService } from './event.service';
import { Role } from 'src/common/schema/roles.enum';
import { Roles } from 'src/common/decorator/roles.decorator';
import { Prisma } from '@prisma/client';
import { Content } from '@prisma/client';
import { CreateContentDto, UpdateContentDto } from 'src/common/dto/contentDto';
import { FileInterceptor } from '@nestjs/platform-express';
@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventController {
  constructor(private readonly eventsService: EventService) {}

  @Get('count-by-day')
  @Roles(Role.USER, Role.ADMIN)
  async getEventCountByDay(
    @Req() req,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const userId = req.user.id;
    return this.eventsService.getEventCountByDay(
      parseInt(year),
      parseInt(month),
      userId,
    );
  }

  @Get('by-day')
  @Roles(Role.USER, Role.ADMIN)
  async getEventsByDay(@Req() req, @Query('date') date: string) {
    const userId = req.user.id;
    return this.eventsService.getEventsByDay(date, userId);
  }

  @Get('me')
  @Roles(Role.USER, Role.ADMIN)
  async getMyEvents(@Req() req) {
    const userId = req.user.id;
    return this.eventsService.getAllEventsByUserId(userId);
  }

  @Get(':id')
  @Roles(Role.USER, Role.ADMIN)
  async getEventById(@Param('id') id: string) {
    const event = await this.eventsService.getEventById(parseInt(id));

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    return event;
  }

  @Post()
  @Roles(Role.USER, Role.ADMIN)
  @UseInterceptors(FileInterceptor('image'))
  async createEvent(
    @Body() data: Prisma.EventCreateInput,
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    const userId: number = +req.user.id;
    return this.eventsService.createEvent(data, userId, file);
  }

  @Put(':id')
  @Roles(Role.USER, Role.ADMIN)
  @UseInterceptors(FileInterceptor('image'))
  async updateEvent(
    @Param('id') id: string,
    @Body() data: Prisma.EventUpdateInput,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.eventsService.updateEvent(+id, data, file);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  async deleteEvent(@Param('id') id: string) {
    return this.eventsService.deleteEvent(parseInt(id));
  }

  // New endpoints for contents:

  @Get(':eventId/contents')
  @Roles(Role.USER, Role.ADMIN)
  async getContents(@Param('eventId') eventId: number): Promise<Content[]> {
    return this.eventsService.getContentsByEventId(eventId);
  }

  @Post(':eventId/contents')
  @Roles(Role.USER, Role.ADMIN)
  async createContent(
    @Req() req,
    @Param('eventId') eventId: number,
    @Body() createContentDto: CreateContentDto,
  ): Promise<Content> {
    return this.eventsService.createContent(
      eventId,
      createContentDto,
      req.user.id,
    );
  }

  @Put(':eventId/contents/:id')
  @Roles(Role.USER, Role.ADMIN)
  async updateContent(
    @Req() req,
    @Param('id') id: number,
    @Param('eventId') eventId: number,
    @Body() updateContentDto: UpdateContentDto,
  ): Promise<Content> {
    return this.eventsService.updateContent(
      id,
      eventId,
      updateContentDto,
      req.user.id,
    );
  }

  @Delete(':eventId/contents/:id')
  @Roles(Role.ADMIN)
  async deleteContent(
    @Param('id') id: number,
    @Param('eventId') eventId: number,
  ): Promise<Content> {
    return this.eventsService.deleteContent(id, eventId);
  }

  @Get(':eventId/contents/:contentId')
  async getContentById(
    @Param('eventId') eventId: number,
    @Param('contentId') contentId: number,
  ): Promise<Content> {
    return this.eventsService.getContentById(eventId, contentId);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @Roles(Role.USER, Role.ADMIN)
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    const filePath = await this.eventsService.uploadContentFile(file);
    return { filePath };
  }

  @Post(':eventId/contents/:contentId/email')
  @Roles(Role.ADMIN)
  async emailExistingContent(
    @Param('eventId') eventId: number,
    @Param('contentId') contentId: number,
    @Request() req,
  ) {
    const userEmail = req.user.email;
    return this.eventsService.emailContent(eventId, contentId, userEmail);
  }

  @Get('content-recipients/me')
  @Roles(Role.USER, Role.ADMIN)
  async getMyRecipients(@Req() req) {
    const userId = req.user.id;
    return this.eventsService.getAllUniqueRecipientsByUser(userId);
  }
}
