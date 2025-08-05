import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateSchoolDto } from '../users/dto/create-school.dto';
import { JwtService } from '@nestjs/jwt';
import { UpdateSchoolDto } from './dto/UpdateSchoolDto';

@Injectable()
export class TrustService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Get all schools under the given trust
   */
  async getSchoolsByTrust(trustId: number) {
    return this.prisma.user.findMany({
      where: {
        trust_id: trustId,
      },
      select: {
        id: true,
        email: true,
        created_at: true,
        profile: {
          select: {
            first_name: true,
            last_name: true,
            phone: true,
            school_name: true,
            school_type: true,
            school_city: true,
            school_region: true,
            school_country: true,
            school_user_position: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            events: true,
            contentRecipients: true,
          },
        },
      },
    });
  }

  /**
   * Update school info if it belongs to the trust
   */
  async updateSchoolByTrust(
    trustId: number,
    schoolId: number,
    dto: UpdateSchoolDto,
  ) {
    const school = await this.prisma.user.findFirst({
      where: {
        id: schoolId,
        trust_id: trustId,
      },
      include: { profile: true },
    });

    if (!school) {
      throw new NotFoundException('School not found or not under your trust');
    }

    return this.prisma.profile.update({
      where: { user_id: schoolId },
      data: {
        ...dto,
      },
    });
  }

  /**
   * Delete school if it belongs to the trust
   */
  async deleteSchoolByTrust(trustId: number, schoolId: number) {
    const school = await this.prisma.user.findFirst({
      where: {
        id: schoolId,
        trust_id: trustId,
      },
    });

    if (!school) {
      throw new NotFoundException('School not found or not under your trust');
    }

    await this.prisma.user.delete({
      where: { id: schoolId },
    });

    return { message: 'School deleted successfully' };
  }
}
