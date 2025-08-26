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

  /**
   * Create a school under an organization
   */
  @Post('create')
  async createSchool(@Body() createSchoolDto: CreateSchoolDto) {
    try {
      const school = await this.schoolService.createSchool(createSchoolDto);
      return { success: true, data: school };
    } catch (error) {
      console.error(error);
      throw new HttpException(
        error.message || 'Failed to create school',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get school details by ID
   */
  @Get(':id')
  async getSchool(@Param('id', ParseIntPipe) id: number) {
    try {
      const school = await this.schoolService.getSchoolById(id);
      return { success: true, data: school };
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
      return { success: true, data: updated };
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
      return { success: true, message: 'School deleted successfully' };
    } catch (error) {
      console.error(error);
      throw new HttpException(
        error.message || 'Failed to delete school',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
