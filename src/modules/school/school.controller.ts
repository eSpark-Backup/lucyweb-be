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
  UploadedFile,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
      image: school.image,
      is_paid: school.is_paid,
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
  @UseInterceptors(FileInterceptor('image'))
  async createSchool(
    @UploadedFile() file: Express.Multer.File,
    @Body() createSchoolDto: CreateSchoolDto,
  ) {
    try {
      let imageUrl: string | undefined;
      if (file) {
        imageUrl = await this.storageService.uploadFile(file);
      }

      // pass optional password along to service if provided
      const school = await this.schoolService.createSchool({
        ...createSchoolDto,
        password: createSchoolDto.password || undefined,
        image: imageUrl || createSchoolDto.image,
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
  @UseInterceptors(FileInterceptor('image'))
  async updateSchool(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Body() updateData: Partial<CreateSchoolDto>,
  ) {
    try {
      if (file) {
        const imageUrl = await this.storageService.uploadFile(file);
        updateData.image = imageUrl;
      }
      // ignore password updates through this endpoint
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
}
