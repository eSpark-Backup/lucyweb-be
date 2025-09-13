/* eslint-disable prettier/prettier */
import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { OrganizationDetails } from 'src/common/schema/organizationDetails.interface';
import { Role } from 'src/common/schema/roles.enum';
import { UserDetails } from 'src/common/schema/userDetails.interface';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateOrganizationDto } from 'src/common/dto/organizationCreateDto';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create organization (supports trusts)
   */
  async createOrganization(
    createOrganizationDto: CreateOrganizationDto,
    email: string,
  ): Promise<{ message: string }> {
    const {
      name,
      address,
      is_trust = false,
      selected_school_count = null,
    } = createOrganizationDto;

    // Find the user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if the user is already part of an organization
    if (user.profile?.organization_id) {
      throw new ConflictException('User already belongs to an organization');
    }

    // Create the organization with trust fields if provided
    const organization = await this.prisma.organization.create({
      data: {
        name,
        address,
        is_trust,
        selected_school_count,
        trust_locked: false,
      },
    });

    // Update the user's profile with the organization ID and promote the role to "admin"
    await this.prisma.profile.update({
      where: { user_id: user.id },
      data: {
        organization_id: organization.id,
        role_id: 2,
      },
    });

    return { message: 'Organization created successfully' };
  }

  /**
   * Return organization details for a user identified by email
   * If role is ADMIN or MODERATOR, include subscription and userCount
   */
  async getOrganizationDetailsByEmail(
    email: string,
    role: Role,
  ): Promise<OrganizationDetails> {
    const userProfile = await this.prisma.profile.findFirst({
      where: { user: { email } },
      include: {
        organization: {
          include: {
            schools: {
              include: {
                events: {
                  include: {
                    contents: true,
                  },
                },
              },
            },
          },
        },
        role: true,
      },
    });

    if (!userProfile) throw new NotFoundException('User profile not found');

    const { organization } = userProfile;
    if (!organization)
      throw new NotFoundException(
        'User is not associated with any organization',
      );

    const baseData: any = {
      id: organization.id,
      name: organization.name,
      address: organization.address,
      is_trust: organization.is_trust,
      selected_school_count: organization.selected_school_count,
      owner: {
        fullName: `${userProfile.first_name} ${userProfile.last_name}`,
        email,
      },
      schools: organization.schools.map((school) => ({
        id: school.id,
        name: school.name,
        email: school.email,
        is_paid: school.is_paid,
        events: school.events.map((event) => ({
          id: event.id,
          name: event.name,
          date_time: event.date_time,
          contents: event.contents,
        })),
      })),
    };

    const roleName = userProfile.role?.name?.toLowerCase() ?? '';
    if (
      role === Role.ADMIN ||
      role === Role.MODERATOR ||
      roleName === 'admin' ||
      roleName === 'moderator'
    ) {
      const userCount = await this.prisma.profile.count({
        where: { organization_id: organization.id },
      });
      return { ...baseData, userCount };
    }

    return baseData;
  }

  /**
   * Update organization details (name, address, is_trust, selected_school_count)
   * Only Owner or Admin allowed
   */
  async updateOrganizationDetails(
    email: string,
    updateData: Partial<CreateOrganizationDto>,
  ): Promise<{ message: string; updatedOrganization: any }> {
    // Fetch user profile with organization and role
    const userProfile = await this.prisma.profile.findFirst({
      where: {
        user: { email },
      },
      include: {
        organization: true,
        role: true,
      },
    });

    if (!userProfile) {
      throw new NotFoundException('User profile not found');
    }

    const { organization, role } = userProfile;

    if (!organization) {
      throw new NotFoundException(
        'User is not associated with any organization',
      );
    }

    // Check if the user has permissions (Owner or Admin)
    const roleName = role?.name?.toLowerCase() ?? '';
    if (roleName !== 'owner' && roleName !== 'admin') {
      throw new ForbiddenException(
        'You do not have permission to update organization details',
      );
    }

    // Build update payload (only defined fields)
    const data: any = {};
    if (updateData.name !== undefined) data.name = updateData.name;
    if (updateData.address !== undefined) data.address = updateData.address;
    if (updateData.is_trust !== undefined) data.is_trust = updateData.is_trust;
    if (updateData.selected_school_count !== undefined)
      data.selected_school_count = updateData.selected_school_count;

    if (Object.keys(data).length === 0) {
      throw new Error('At least one field must be provided for update');
    }

    // Update the organization
    const updatedOrganization = await this.prisma.organization.update({
      where: {
        id: organization.id,
      },
      data,
    });

    return {
      message: 'Organization details updated successfully',
      updatedOrganization,
    };
  }

  /**
   * List users in the same organization (admin / moderator only)
   */
  async getUsersByOrganization(
    email: string,
    page: number,
    limit: number,
  ): Promise<{
    users: Array<UserDetails>;
    total: number;
    page: number;
    limit: number;
  }> {
    // Fetch the user's profile and organization details
    const userProfile = await this.prisma.profile.findFirst({
      where: { user: { email } },
      include: { organization: true, role: true },
    });

    if (!userProfile || !userProfile.organization) {
      throw new NotFoundException(
        'You are not associated with any organization',
      );
    }

    const { organization, role } = userProfile;

    // Only admin and moderators are allowed
    const roleName = role?.name?.toLowerCase() ?? '';
    if (roleName !== 'admin' && roleName !== 'moderator') {
      throw new ForbiddenException('You do not have access to this resource');
    }

    // Pagination settings
    const skip = (page - 1) * limit;
    const take = limit;

    // Fetch users in the same organization
    const [users, total] = await Promise.all([
      this.prisma.profile.findMany({
        where: { organization_id: organization.id },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          user: {
            select: { email: true },
          },
          role: {
            select: { name: true },
          },
        },
        skip,
        take,
      }),
      this.prisma.profile.count({
        where: { organization_id: organization.id },
      }),
    ]);

    // Format the data for the response
    const formattedUsers = users.map((user) => ({
      id: user.id,
      fullName: `${user.first_name} ${user.last_name}`,
      email: user.user.email,
      role: user.role.name,
    }));

    return {
      users: formattedUsers,
      total,
      page,
      limit,
    };
  }
}
