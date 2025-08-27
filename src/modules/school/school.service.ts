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
        include: { schools: true }, // include schools for trust logic
      });

      if (!organization) {
        throw new HttpException('Organization not found', HttpStatus.NOT_FOUND);
      }

      const school = await this.prisma.school.create({
        data: {
          name: createSchoolDto.name,
          address: createSchoolDto.address,
          organization_id: createSchoolDto.organization_id,
        },
      });

      const cost = this.calculateCost(organization);

      return { ...school, organization, cost };
    } catch (error) {
      console.error(error);
      throw new HttpException(
        'Failed to create school',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Fetch all schools with calculated cost
   */
  async findAll() {
    try {
      const schools = await this.prisma.school.findMany({
        include: { organization: { include: { schools: true } } },
      });

      return schools.map((school) => {
        const cost = this.calculateCost(school.organization);
        return { ...school, cost };
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
   * Fetch a single school by ID with calculated cost
   */
  async getSchoolById(id: number) {
    const school = await this.prisma.school.findUnique({
      where: { id },
      include: { organization: { include: { schools: true } } },
    });

    if (!school) {
      throw new HttpException(
        `School with ID ${id} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    const cost = this.calculateCost(school.organization);

    return { ...school, cost };
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

  /**
   * Calculate cost per school based on trust rules
   */
  private calculateCost(organization: any) {
    if (!organization.is_trust) return 50;

    const createdCount = organization.schools?.length ?? 0;
    const selectedCount = organization.selected_school_count ?? 0;

    if (organization.trust_locked) return 10;

    if (createdCount >= selectedCount) {
      this.prisma.organization.update({
        where: { id: organization.id },
        data: { trust_locked: true },
      });
      return 10;
    }

    return 50;
  }
}
