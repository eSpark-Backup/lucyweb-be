/* eslint-disable prettier/prettier */
import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  Delete,
  HttpException,
  HttpStatus,
  ParseIntPipe,
  UseInterceptors,
  UploadedFiles,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { SchoolService } from './school.service';
import { StorageService } from '../storage/storage.service';
import { CreateSchoolDto } from '../../common/dto/createSchoolDto';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/common/guard/jwtAuth.guard';
import { Roles } from 'src/common/decorator/roles.decorator';
import { Role } from 'src/common/schema/roles.enum';

interface AuthenticatedRequest extends Request {
  user: any;
}

@UseGuards(JwtAuthGuard)
@Roles(Role.ADMIN, Role.USER, Role.MODERATOR)
@Controller('schools')
export class SchoolController {
  constructor(
    private readonly schoolService: SchoolService,
    private readonly storageService: StorageService,
  ) {}

  private formatSchoolResponse(school: any) {
    return {
      // 🔹 All School fields
      id: school.id,
      name: school.name,
      address: school.address,
      phone: school.phone,
      email: school.email,
      description: school.description,
      images: school.images ?? [],
      is_paid: school.is_paid,
      is_trial: school.is_trial,
      trial_started_at: school.trial_started_at,
      trial_ends_at: school.trial_ends_at,
      is_special: school.is_special,
      subscription_end: school.subscription_end,
      created_at: school.created_at,
      updated_at: school.updated_at,
      cost: school.cost ?? null,

      // 🔹 Organization (with extra fields if any in DB)
      organization: school.organization
        ? {
            ...school.organization,
            selected_school_count:
              school.organization.selected_school_count ?? null,
            unit_price: school.organization.unit_price ?? null,
          }
        : null,

      // 🔹 Events with every field + nested contents
      events:
        school.events?.map((event: any) => ({
          ...event, // includes id, name, type, start_date, end_date, description, user_id, school_id, image, created_at, updated_at, etc.
          contents:
            event.contents?.map((c: any) => ({
              ...c, // includes id, event_id, content_type, text_content, attachment, created_at, updated_at
              content_recipients:
                c.content_recipients?.map((r: any) => ({
                  ...r, // every field from ContentRecipient
                })) ?? [],
            })) ?? [],
        })) ?? [],
    };
  }

  @Post('create')
  @UseInterceptors(FilesInterceptor('images_files'))
  async createSchool(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() createSchoolDto: CreateSchoolDto & { images_urls?: string[] },
  ) {
    try {
      const imageUrls: string[] = [];

      if (files?.length) {
        const uploaded = await Promise.all(
          files.map((f) => this.storageService.uploadFile(f)),
        );
        imageUrls.push(...uploaded);
      }

      if (
        createSchoolDto.images_urls &&
        Array.isArray(createSchoolDto.images_urls)
      ) {
        imageUrls.push(...createSchoolDto.images_urls);
      } else if (
        createSchoolDto.images_urls &&
        typeof createSchoolDto.images_urls === 'string'
      ) {
        imageUrls.push(createSchoolDto.images_urls);
      }

      const school = await this.schoolService.createSchool({
        ...createSchoolDto,
        images: imageUrls,
        password: createSchoolDto.password || undefined,
      });

      return {
        success: true,
        message: 'School created successfully',
        data: this.formatSchoolResponse(school),
      };
    } catch (error) {
      console.error(error);
      throw new HttpException(
        error.message || 'Failed to create school',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  async getAllSchools(@Req() req: AuthenticatedRequest) {
    try {
      if (!req.user || !req.user.id) {
        throw new HttpException(
          'User information is missing',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const { data } = await this.schoolService.findAll(req.user.id);
      return {
        success: true,
        message: 'Schools fetched successfully',
        data: data.map((school) => this.formatSchoolResponse(school)),
      };
    } catch (error: any) {
      console.error('Error fetching schools:', error);
      throw new HttpException(
        error.message || 'Failed to fetch schools',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  async getSchool(@Param('id', ParseIntPipe) id: number) {
    try {
      const school = await this.schoolService.getSchoolById(id);
      return {
        success: true,
        message: 'School fetched successfully',
        data: this.formatSchoolResponse(school),
      };
    } catch (error) {
      console.error(error);
      throw new HttpException(
        error.message || 'Failed to fetch school',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch(':id')
  @UseInterceptors(FilesInterceptor('images_files'))
  async updateSchool(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() updateData: Partial<CreateSchoolDto> & { images_urls?: string[] },
  ) {
    try {
      const imageUrls: string[] = [];

      // 1️⃣ Upload new files if any
      if (files?.length) {
        const uploaded = await Promise.all(
          files.map((f) => this.storageService.uploadFile(f)),
        );
        imageUrls.push(...uploaded);
      }

      // 2️⃣ Merge additional URLs
      if (updateData.images_urls && Array.isArray(updateData.images_urls)) {
        imageUrls.push(...updateData.images_urls);
      } else if (
        updateData.images_urls &&
        typeof updateData.images_urls === 'string'
      ) {
        imageUrls.push(updateData.images_urls);
      }

      // 3️⃣ Pass new images or URLs to service
      if (imageUrls.length) {
        (updateData as any).images = imageUrls;
      }

      delete (updateData as any).password;

      const updated = await this.schoolService.updateSchool(id, updateData);

      return {
        success: true,
        message: 'School updated successfully',
        data: this.formatSchoolResponse(updated),
      };
    } catch (error) {
      console.error(error);
      throw new HttpException(
        error.message || 'Failed to update school',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  async deleteSchool(@Param('id', ParseIntPipe) id: number) {
    try {
      await this.schoolService.deleteSchool(id);
      return {
        success: true,
        message: 'School deleted successfully',
        data: { id },
      };
    } catch (error) {
      console.error(error);
      throw new HttpException(
        error.message || 'Failed to delete school',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/trial/start')
  async startTrial(@Param('id', ParseIntPipe) id: number) {
    try {
      const result = await this.schoolService.startTrial(id);
      return {
        success: true,
        message: result.message,
        data: { trial_ends_at: result.trial_ends_at },
      };
    } catch (error) {
      console.error(error);
      throw new HttpException(
        error.message || 'Failed to start trial',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/trial/cancel')
  async cancelTrial(@Param('id', ParseIntPipe) id: number) {
    try {
      const result = await this.schoolService.cancelTrial(id);
      return {
        success: true,
        message: result.message,
      };
    } catch (error) {
      console.error(error);
      throw new HttpException(
        error.message || 'Failed to cancel trial',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
