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
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guard/jwtAuth.guard';
import { EventService } from './event.service';
import { Role } from 'src/common/schema/roles.enum';
import { Roles } from 'src/common/decorator/roles.decorator';
import { Prisma, Content } from '@prisma/client';
import { CreateContentDto, UpdateContentDto } from 'src/common/dto/contentDto';
import { FileInterceptor } from '@nestjs/platform-express';
import { SendReminderEmailDto } from 'src/common/dto/sentReminderEmailDto';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventController {
  constructor(private readonly eventsService: EventService) {}

  @Get('count-by-day')
  @Roles(Role.USER, Role.ADMIN, Role.SCHOOL)
  async getEventCountByDay(
    @Req() req,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.eventsService.getEventCountByDay(
      parseInt(year),
      parseInt(month),
      req.user.id,
    );
  }

  @Get('by-day')
  @Roles(Role.USER, Role.ADMIN, Role.SCHOOL)
  async getEventsByDay(@Req() req, @Query('date') date: string) {
    return this.eventsService.getEventsByDay(date, req.user.id);
  }

  @Get('me')
  @Roles(Role.USER, Role.ADMIN, Role.SCHOOL)
  async getMyEvents(@Req() req) {
    return this.eventsService.getAllEventsByUserId(req.user.id);
  }

  @Get(':id')
  @Roles(Role.USER, Role.ADMIN, Role.SCHOOL)
  async getEventById(@Param('id') id: string) {
    const event = await this.eventsService.getEventById(parseInt(id));
    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }
    return event;
  }

  @Post()
  @Roles(Role.USER, Role.ADMIN, Role.SCHOOL)
  @UseInterceptors(FileInterceptor('image'))
  async createEvent(
    @Body() data: Prisma.EventCreateInput,
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    return this.eventsService.createEvent(data, req.user.id, file);
  }

  @Put(':id')
  @Roles(Role.USER, Role.ADMIN, Role.SCHOOL)
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

  @Get(':eventId/contents')
  @Roles(Role.USER, Role.ADMIN, Role.SCHOOL)
  async getContents(
    @Param('eventId', ParseIntPipe) eventId: number,
  ): Promise<Content[]> {
    return this.eventsService.getContentsByEventId(eventId);
  }

  @Post(':eventId/contents')
  @Roles(Role.USER, Role.ADMIN, Role.SCHOOL)
  async createContent(
    @Req() req,
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() createContentDto: CreateContentDto,
  ): Promise<Content> {
    return this.eventsService.createContent(
      eventId,
      createContentDto,
      req.user.id,
    );
  }

  @Put(':eventId/contents/:id')
  @Roles(Role.USER, Role.ADMIN, Role.SCHOOL)
  async updateContent(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
    @Param('eventId', ParseIntPipe) eventId: number,
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
    @Param('id', ParseIntPipe) id: number,
    @Param('eventId', ParseIntPipe) eventId: number,
  ): Promise<Content> {
    return this.eventsService.deleteContent(id, eventId);
  }

  @Get(':eventId/contents/:contentId')
  async getContentById(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Param('contentId', ParseIntPipe) contentId: number,
  ): Promise<Content> {
    return this.eventsService.getContentById(eventId, contentId);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @Roles(Role.USER, Role.ADMIN, Role.SCHOOL)
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    return { filePath: await this.eventsService.uploadContentFile(file) };
  }

  @Post(':eventId/contents/:contentId/email')
  @Roles(Role.ADMIN)
  async emailExistingContent(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Param('contentId', ParseIntPipe) contentId: number,
    @Request() req,
  ) {
    return this.eventsService.emailContent(eventId, contentId, req.user.email);
  }

  @Get('content-recipients/me')
  @Roles(Role.USER, Role.ADMIN, Role.SCHOOL)
  async getMyRecipients(@Req() req) {
    return this.eventsService.getAllUniqueRecipientsByUser(req.user.id);
  }

  @Post(':eventId/send-email')
  async sendEmailToRecipients(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() data: SendReminderEmailDto,
  ) {
    return this.eventsService.sendEmailToRecipients(eventId, data);
  }
}
