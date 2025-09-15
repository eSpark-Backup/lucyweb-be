/* eslint-disable prettier/prettier */
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SchoolService {
  constructor(private readonly prisma: PrismaService) {}

  // Helper - returns latest payment (success first, fallback to any)
  private async getLatestPayment(organizationId: number) {
    let payment = await this.prisma.payment.findFirst({
      where: { organization_id: organizationId, status: 'success' },
      orderBy: { created_at: 'desc' },
      select: {
        schools_count: true,
        unit_price: true,
        amount: true,
        created_at: true,
      },
    });

    if (!payment) {
      payment = await this.prisma.payment.findFirst({
        where: { organization_id: organizationId },
        orderBy: { created_at: 'desc' },
        select: {
          schools_count: true,
          unit_price: true,
          amount: true,
          created_at: true,
        },
      });
    }

    return payment;
  }

  // Normalize unit_price -> human friendly
  private normalizeUnitPrice(
    unitPrice?: number | null,
    amount?: number | null,
  ): number | null {
    if (unitPrice != null) return unitPrice > 100 ? unitPrice / 100 : unitPrice;
    if (amount != null) return amount > 100 ? amount / 100 : amount;
    return null;
  }

  // Calculate cost per school considering paid/unpaid & trust_locked
  private async calculateCostPerSchool(
    organizationId: number,
    unpaidOnly = false, // if true, only consider unpaid schools
  ): Promise<number> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        is_trust: true,
        selected_school_count: true,
        paid_school_count: true,
        trust_locked: true,
      },
    });

    if (!org || !org.is_trust) return 50;

    // If discount already locked, always £10 for all
    if (org.trust_locked) return 10;

    // ────────── Trust pricing logic ──────────
    if (unpaidOnly) {
      // Check against *paid* schools, not payments aggregation
      if (org.paid_school_count >= (org.selected_school_count ?? 0)) {
        // Threshold reached: lock discount permanently
        await this.prisma.organization.update({
          where: { id: organizationId },
          data: { trust_locked: true },
        });
        return 10;
      }
      // Before threshold: unpaid schools cost 50
      return 50;
    }

    // Regular calculation for all schools
    if (org.paid_school_count >= (org.selected_school_count ?? 0)) {
      await this.prisma.organization.update({
        where: { id: organizationId },
        data: { trust_locked: true },
      });
      return 10;
    }

    return 50;
  }

  async createSchool(data: any) {
    try {
      if (data.organization_id)
        data.organization_id = Number(data.organization_id);

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

      let userId: number | null = null;
      if (organization.is_trust && data.password) {
        const hashed = await bcrypt.hash(data.password, 10);
        const newUser = await this.prisma.user.create({
          data: {
            email: data.email,
            password: hashed,
            role: { connect: { name: 'school' } },
          },
        });
        userId = newUser.id;
        delete data.password;
      } else {
        delete data.password;
      }

      const created = await this.prisma.school.create({
        data: {
          ...data,
          user_id: userId ?? null,
        },
        include: { organization: true },
      });

      if (organization.is_trust && !created.organization.trust_locked) {
        const createdCount = await this.prisma.school.count({
          where: { organization_id: created.organization_id },
        });
        if (
          organization.selected_school_count &&
          createdCount >= organization.selected_school_count
        ) {
          await this.prisma.organization.update({
            where: { id: created.organization_id },
            data: { trust_locked: true },
          });
        }
      }

      // Cost for this new school only (unpaid logic)
      const cost = await this.calculateCostPerSchool(
        created.organization_id,
        true,
      );

      const payment = await this.getLatestPayment(created.organization_id);
      const selected_school_count =
        payment?.schools_count ??
        created.organization?.selected_school_count ??
        null;
      const raw_unit_price = payment?.unit_price ?? null;

      return {
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

      // ✅ Fetch schools with organization, events, and event contents
      const schools = await this.prisma.school.findMany({
        where: { organization_id: profile.organization_id },
        include: {
          organization: true,
          events: { include: { contents: true } },
        },
      });

      // Calculate cost per school
      const costs = await Promise.all(
        schools.map(async (s) => ({
          id: s.id,
          cost: await this.calculateCostPerSchool(s.organization_id, true),
        })),
      );
      const costMap = new Map(costs.map((c) => [c.id, c.cost]));

      const payment = await this.getLatestPayment(profile.organization_id);
      const selected_school_count = payment?.schools_count ?? null;
      const raw_unit_price = payment?.unit_price ?? null;

      const schoolsWithBilling = schools.map((s) => ({
        ...s,
        cost: costMap.get(s.id) ?? 50,
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
        include: {
          organization: true,
          events: {
            // 🚨 No select, just include full nested models
            include: {
              contents: { include: { content_recipients: true } },
            },
          },
        },
      });

      if (!school) return null;

      const cost = await this.calculateCostPerSchool(
        school.organization_id,
        true,
      );
      const payment = await this.getLatestPayment(school.organization_id);
      const selected_school_count =
        payment?.schools_count ??
        school.organization?.selected_school_count ??
        null;
      const raw_unit_price = payment?.unit_price ?? null;

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
      if (data.organization_id)
        data.organization_id = Number(data.organization_id);
      delete data.password;

      const updated = await this.prisma.school.update({
        where: { id },
        data,
        include: { organization: true },
      });

      const cost = await this.calculateCostPerSchool(
        updated.organization_id,
        true,
      );
      const payment = await this.getLatestPayment(updated.organization_id);
      const selected_school_count =
        payment?.schools_count ??
        updated.organization?.selected_school_count ??
        null;
      const raw_unit_price = payment?.unit_price ?? null;

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
      // ── Fetch the school first (include user_id to delete its own login user)
      const school = await this.prisma.school.findUnique({
        where: { id },
        select: {
          id: true,
          organization_id: true,
          is_paid: true,
          user_id: true,
        },
      });

      if (!school) {
        throw new HttpException('School not found', HttpStatus.NOT_FOUND);
      }

      // ── Delete related records inside a single transaction
      await this.prisma.$transaction(async (tx) => {
        // 1️⃣ Delete all contents of the school’s events
        await tx.content.deleteMany({
          where: { event: { school_id: id } },
        });

        // 2️⃣ Delete all events of the school
        await tx.event.deleteMany({
          where: { school_id: id },
        });

        // 3️⃣ Delete the school itself
        await tx.school.delete({
          where: { id },
        });

        // 4️⃣ Delete the school’s own login user so email can be reused
        if (school.user_id) {
          await tx.user.delete({
            where: { id: school.user_id },
          });
        }
      });

      // ── Re-count paid schools after deletion
      const paidCount = await this.prisma.school.count({
        where: { organization_id: school.organization_id, is_paid: true },
      });

      // ── Update organization’s paid_school_count
      await this.prisma.organization.update({
        where: { id: school.organization_id },
        data: { paid_school_count: paidCount },
      });

      // ── Get updated org details for pricing checks
      const org = await this.prisma.organization.findUnique({
        where: { id: school.organization_id },
        select: {
          is_trust: true,
          selected_school_count: true,
          trust_locked: true,
          paid_school_count: true,
        },
      });

      // ── Determine cost per school after deletion
      let costPerSchool = 50; // default
      if (org?.is_trust) {
        if (org.trust_locked) {
          costPerSchool = 10;
        } else if (
          (org.selected_school_count ?? 0) > 0 &&
          org.paid_school_count >= (org.selected_school_count ?? 0)
        ) {
          // threshold reached again → lock discount
          await this.prisma.organization.update({
            where: { id: school.organization_id },
            data: { trust_locked: true },
          });
          costPerSchool = 10;
        }
      }

      return {
        message:
          'School deleted successfully (with all events, contents & its user)',
        school_id: id,
        current_cost_per_school: costPerSchool,
        paid_school_count: org?.paid_school_count ?? 0,
      };
    } catch (error: any) {
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
