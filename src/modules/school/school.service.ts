/* eslint-disable prettier/prettier */
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SchoolService {
  constructor(private readonly prisma: PrismaService) {}

  async createSchool(data: any) {
    try {
      if (data.organization_id) {
        data.organization_id = Number(data.organization_id);
      }
      return await this.prisma.school.create({
        data,
        include: { organization: true },
      });
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
        // Prisma unique constraint error
        throw new HttpException(
          'A school with this email already exists',
          HttpStatus.BAD_REQUEST,
        );
      }

      throw new HttpException(
        error.message || 'Failed to create school',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAll(userId: number) {
    try {
      // First, fetch the profile of the logged-in user to get their organization
      const profile = await this.prisma.profile.findUnique({
        where: { user_id: userId },
        select: { organization_id: true },
      });

      if (!profile?.organization_id) {
        throw new HttpException(
          'User is not associated with any organization',
          HttpStatus.FORBIDDEN,
        );
      }

      // Fetch only schools belonging to that organization
      const schools = await this.prisma.school.findMany({
        where: { organization_id: profile.organization_id },
        include: { organization: true },
      });

      return { data: schools };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch schools',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getSchoolById(id: number) {
    try {
      return await this.prisma.school.findUnique({
        where: { id },
        include: { organization: true },
      });
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch school',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateSchool(id: number, data: any) {
    try {
      if (data.organization_id) {
        data.organization_id = Number(data.organization_id);
      }
      return await this.prisma.school.update({
        where: { id },
        data,
        include: { organization: true },
      });
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to update school',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteSchool(id: number) {
    try {
      return await this.prisma.school.delete({
        where: { id },
      });
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to delete school',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Example place where `.join` caused issue (FIXED with cast)
  async someMethodUsingJoin() {
    const result = await this.prisma.school.findMany({
      include: { organization: true },
    });

    const orgNames: string[] = result.map((r) => r.organization?.name || ''); // ✅ Explicitly typed
    return orgNames.join(', ');
  }

  async anotherMethodUsingJoin() {
    const result = await this.prisma.school.findMany({
      include: { organization: true },
    });

    const schoolNames: string[] = result.map((r) => r.name || ''); // ✅ Explicitly typed
    return schoolNames.join('; ');
  }
}
