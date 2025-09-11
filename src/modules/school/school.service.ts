/* eslint-disable prettier/prettier */
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SchoolService {
  constructor(private readonly prisma: PrismaService) {}

  // Helper - returns latest successful payment for an org
  private async getLatestSuccessfulPayment(organizationId: number) {
    return this.prisma.payment.findFirst({
      where: { organization_id: organizationId, status: 'success' },
      orderBy: { created_at: 'desc' },
      select: {
        schools_count: true,
        unit_price: true,
        amount: true,
        created_at: true,
      },
    });
  }

  // Normalize unit_price -> human friendly (try to convert pence->GBP if it looks like pence)
  private normalizeUnitPrice(
    unitPrice?: number | null,
    amount?: number | null,
  ): number | null {
    if (unitPrice == null) return amount ?? null;
    if (unitPrice > 100) {
      return unitPrice / 100;
    }
    return unitPrice;
  }

  async createSchool(data: any) {
    try {
      if (data.organization_id) {
        data.organization_id = Number(data.organization_id);
      }

      // Fetch organization
      const organization = await this.prisma.organization.findUnique({
        where: { id: data.organization_id },
        select: { id: true, is_trust: true, selected_school_count: true },
      });

      if (!organization) {
        throw new HttpException(
          'Organization not found',
          HttpStatus.BAD_REQUEST,
        );
      }

      // If org is NOT a trust, allow only one school
      if (!organization.is_trust) {
        const existingSchool = await this.prisma.school.findFirst({
          where: { organization_id: data.organization_id },
        });

        if (existingSchool) {
          throw new HttpException(
            'An individual organization can only create one school',
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      // ---- handle school user creation when trust org and password provided ----
      let userId: number | null = null;
      if (organization.is_trust && data.password) {
        const hashed = await bcrypt.hash(data.password, 10);
        const newUser = await this.prisma.user.create({
          data: {
            email: data.email,
            password: hashed,
            role: { connect: { name: 'School' } },
          },
        });
        userId = newUser.id;
        delete data.password; // avoid saving plain password in school table
      } else {
        // remove password if non-trust or not provided
        delete data.password;
      }

      const created = await this.prisma.school.create({
        data: {
          ...data,
          user_id: userId ?? null,
        },
        include: { organization: true },
      });

      // enrich response with billing info derived from latest successful payment
      const payment = await this.getLatestSuccessfulPayment(
        created.organization_id,
      );

      const selected_school_count =
        payment?.schools_count ??
        created.organization?.selected_school_count ??
        null;
      const raw_unit_price = payment?.unit_price ?? null;
      const cost = this.normalizeUnitPrice(
        raw_unit_price,
        payment?.amount ?? null,
      );

      const schoolWithBilling = {
        ...created,
        cost,
        organization: created.organization
          ? {
              ...created.organization,
              selected_school_count,
              unit_price: raw_unit_price,
            }
          : null,
      };

      return schoolWithBilling;
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
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

      const schools = await this.prisma.school.findMany({
        where: { organization_id: profile.organization_id },
        include: { organization: true },
      });

      const orgId = profile.organization_id;
      const payment = await this.getLatestSuccessfulPayment(orgId);
      const selected_school_count = payment?.schools_count ?? null;
      const raw_unit_price = payment?.unit_price ?? null;
      const cost = this.normalizeUnitPrice(
        raw_unit_price,
        payment?.amount ?? null,
      );

      const schoolsWithBilling = schools.map((s) => ({
        ...s,
        cost,
        organization: s.organization
          ? {
              ...s.organization,
              selected_school_count:
                selected_school_count ??
                s.organization.selected_school_count ??
                null,
              unit_price: raw_unit_price,
            }
          : null,
      }));

      return { data: schoolsWithBilling };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to fetch schools',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getSchoolById(id: number) {
    try {
      const school = await this.prisma.school.findUnique({
        where: { id },
        include: { organization: true },
      });

      if (!school) return null;

      const payment = await this.getLatestSuccessfulPayment(
        school.organization_id,
      );
      const selected_school_count =
        payment?.schools_count ??
        school.organization?.selected_school_count ??
        null;
      const raw_unit_price = payment?.unit_price ?? null;
      const cost = this.normalizeUnitPrice(
        raw_unit_price,
        payment?.amount ?? null,
      );

      return {
        ...school,
        cost,
        organization: school.organization
          ? {
              ...school.organization,
              selected_school_count,
              unit_price: raw_unit_price,
            }
          : null,
      };
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
      delete data.password; // prevent accidental overwrite
      const updated = await this.prisma.school.update({
        where: { id },
        data,
        include: { organization: true },
      });

      const payment = await this.getLatestSuccessfulPayment(
        updated.organization_id,
      );
      const selected_school_count =
        payment?.schools_count ??
        updated.organization?.selected_school_count ??
        null;
      const raw_unit_price = payment?.unit_price ?? null;
      const cost = this.normalizeUnitPrice(
        raw_unit_price,
        payment?.amount ?? null,
      );

      return {
        ...updated,
        cost,
        organization: updated.organization
          ? {
              ...updated.organization,
              selected_school_count,
              unit_price: raw_unit_price,
            }
          : null,
      };
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

  async someMethodUsingJoin() {
    const result = await this.prisma.school.findMany({
      include: { organization: true },
    });
    const orgNames: string[] = result.map((r) => r.organization?.name || '');
    return orgNames.join(', ');
  }

  async anotherMethodUsingJoin() {
    const result = await this.prisma.school.findMany({
      include: { organization: true },
    });
    const schoolNames: string[] = result.map((r) => r.name || '');
    return schoolNames.join('; ');
  }
}
