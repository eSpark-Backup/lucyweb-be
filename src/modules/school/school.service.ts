/* eslint-disable prettier/prettier */
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateSchoolDto } from '../../common/dto/createSchoolDto';

@Injectable()
export class SchoolService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new school under an organization
   */
  async createSchool(createSchoolDto: CreateSchoolDto) {
    try {
      const organization = await this.prisma.organization.findUnique({
        where: { id: createSchoolDto.organization_id },
      });

      if (!organization) {
        throw new HttpException('Organization not found', HttpStatus.NOT_FOUND);
      }

      return await this.prisma.school.create({
        data: {
          name: createSchoolDto.name,
          address: createSchoolDto.address,
          organization_id: createSchoolDto.organization_id,
        },
      });
    } catch (error) {
      console.error(error);
      throw new HttpException(
        'Failed to create school',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Fetch all schools
   */
  async findAll() {
    try {
      return await this.prisma.school.findMany({
        include: { organization: true },
      });
    } catch (error) {
      console.error(error);
      throw new HttpException(
        'Failed to fetch schools',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Fetch a single school by ID
   */
  async getSchoolById(id: number) {
    const school = await this.prisma.school.findUnique({
      where: { id },
      include: { organization: true },
    });

    if (!school) {
      throw new HttpException(
        `School with ID ${id} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    return school;
  }

  /**
   * Update a school
   */
  async updateSchool(id: number, data: Partial<CreateSchoolDto>) {
    const school = await this.prisma.school.findUnique({ where: { id } });

    if (!school) {
      throw new HttpException(
        `School with ID ${id} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    try {
      return await this.prisma.school.update({
        where: { id },
        data,
      });
    } catch (error) {
      console.error(error);
      throw new HttpException(
        'Failed to update school',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Delete a school
   */
  async deleteSchool(id: number) {
    const school = await this.prisma.school.findUnique({ where: { id } });

    if (!school) {
      throw new HttpException(
        `School with ID ${id} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    try {
      return await this.prisma.school.delete({ where: { id } });
    } catch (error) {
      console.error(error);
      throw new HttpException(
        'Failed to delete school',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
