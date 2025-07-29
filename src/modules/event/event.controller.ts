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
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.eventsService.getEventCountByDay(
      parseInt(year),
      parseInt(month),
    );
  }

  @Get('by-day')
  @Roles(Role.USER, Role.ADMIN)
  async getEventsByDay(@Query('date') date: string) {
    return this.eventsService.getEventsByDay(date);
  }

  @Get(':id')
  @Roles(Role.USER, Role.ADMIN)
  async getEventById(@Param('id') id: string) {
    return this.eventsService.getEventById(parseInt(id));
  }

  @Post()
  @Roles(Role.USER, Role.ADMIN)
  async createEvent(@Body() data: Prisma.EventCreateInput, @Request() req) {
    const userId: number = +req.user.id;
    return this.eventsService.createEvent(data, userId);
  }

  @Put(':id')
  @Roles(Role.USER, Role.ADMIN)
  async updateEvent(
    @Param('id') id: string,
    @Body() data: Prisma.EventUpdateInput,
  ) {
    return this.eventsService.updateEvent(parseInt(id), data);
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
    @Param('eventId') eventId: number,
    @Body() createContentDto: CreateContentDto,
  ): Promise<Content> {
    return this.eventsService.createContent(eventId, createContentDto);
  }

  @Put(':eventId/contents/:id')
  @Roles(Role.USER, Role.ADMIN)
  async updateContent(
    @Param('id') id: number,
    @Param('eventId') eventId: number,
    @Body() updateContentDto: UpdateContentDto,
  ): Promise<Content> {
    return this.eventsService.updateContent(id, eventId, updateContentDto);
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
}
