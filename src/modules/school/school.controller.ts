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
} from '@nestjs/common';
import { SchoolService } from './school.service';
import { CreateSchoolDto } from '../../common/dto/createSchoolDto';

@Controller('schools')
export class SchoolController {
  constructor(private readonly schoolService: SchoolService) {}

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
   * Create a school under an organization
   */
  @Post('create')
  async createSchool(@Body() createSchoolDto: CreateSchoolDto) {
    try {
      const school = await this.schoolService.createSchool(createSchoolDto);
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
   * Update school
   */
  @Patch(':id')
  async updateSchool(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateData: Partial<CreateSchoolDto>,
  ) {
    try {
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
