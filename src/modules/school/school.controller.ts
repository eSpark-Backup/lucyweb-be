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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SchoolService } from './school.service';
import { StorageService } from '../storage/storage.service';
import { CreateSchoolDto } from '../../common/dto/createSchoolDto';

@Controller('schools')
export class SchoolController {
  constructor(
    private readonly schoolService: SchoolService,
    private readonly storageService: StorageService,
  ) {}

  private formatSchoolResponse(school: any) {
    return {
      id: school.id,
      name: school.name,
      address: school.address,
      phone: school.phone,
      email: school.email,
      description: school.description,
      image: school.image,
      organization: school.organization
        ? {
            id: school.organization.id,
            name: school.organization.name,
            is_trust: school.organization.is_trust,
            trust_locked: school.organization.trust_locked,
            selected_school_count: school.organization.selected_school_count,
          }
        : null,
      cost: school.cost,
      created_at: school.created_at,
      updated_at: school.updated_at,
    };
  }

  /**
   * Create a school under an organization (supports image upload)
   */
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

      const school = await this.schoolService.createSchool({
        ...createSchoolDto,
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

  /**
   * Get all schools including their organization and calculated cost
   */
  @Get()
  async getAllSchools() {
    try {
      const schools = await this.schoolService.findAll();
      return {
        success: true,
        message: 'Schools fetched successfully',
        data: schools.map((school) => this.formatSchoolResponse(school)),
      };
    } catch (error) {
      console.error(error);
      throw new HttpException(
        error.message || 'Failed to fetch schools',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get school details by ID with calculated cost
   */
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

  /**
   * Update school (optionally supports new image upload)
   */
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

  /**
   * Delete school
   */
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
