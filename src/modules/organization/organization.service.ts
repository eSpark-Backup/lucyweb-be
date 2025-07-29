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

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrganization(
    createOrganizationDto: { name: string; address: string },
    email: string,
  ): Promise<{ message: string }> {
    const { name, address } = createOrganizationDto;

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

    // Create the organization
    const organization = await this.prisma.organization.create({
      data: { name, address },
    });

    // Update the user's profile with the organization ID and promote the role to "admin"
    await this.prisma.profile.update({
      where: { user_id: user.id },
      data: {
        organization_id: organization.id,
        role_id: 2, // "admin" has ID 2 in the Role table
      },
    });

    return { message: 'Organization created successfully' };
  }

  async getOrganizationDetailsByEmail(
    email: string,
    role: Role,
  ): Promise<OrganizationDetails> {
    // Fetch the user's profile with organization details
    const userProfile = await this.prisma.profile.findFirst({
      where: {
        user: { email },
      },
      include: {
        organization: {
          include: {
            subscription: true, // Include subscription details
          },
        },
        role: true, // Include the role name
      },
    });

    if (!userProfile) {
      throw new NotFoundException('User profile not found');
    }

    const { organization } = userProfile;

    if (!organization) {
      throw new NotFoundException(
        'User is not associated with any organization',
      );
    }

    // Data to always return
    const baseData = {
      id: organization.id,
      name: organization.name,
      address: organization.address,
      owner: {
        fullName: `${userProfile.first_name} ${userProfile.last_name}`,
        email,
      },
    };

    // If user is Admin or Moderator, include subscription and user count
    if (role === Role.ADMIN || role === Role.MODERATOR) {
      const userCount = await this.prisma.profile.count({
        where: {
          organization_id: organization.id,
        },
      });

      return {
        ...baseData,
        subscription: organization.subscription
          ? {
              package: organization.subscription.package_name,
              cost: organization.subscription.cost,
              validity: organization.subscription.validity,
              status: organization.subscription_status,
            }
          : null,
        userCount,
      };
    }

    // If user is a regular user, only return basic organization details
    return baseData;
  }

  async updateOrganizationDetails(
    email: string,
    updateData: { name?: string; address?: string },
  ): Promise<{ message: string; updatedOrganization: any }> {
    // Ensure either `name` or `address` is provided
    if (!updateData.name && !updateData.address) {
      throw new Error(
        'At least one field (name or address) must be provided for update',
      );
    }

    // Fetch user profile with organization details
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
    if (role.name !== 'owner' && role.name !== 'admin') {
      throw new ForbiddenException(
        'You do not have permission to update organization details',
      );
    }

    // Update the organization
    const updatedOrganization = await this.prisma.organization.update({
      where: {
        id: organization.id,
      },
      data: {
        name: updateData.name || undefined,
        address: updateData.address || undefined,
      },
    });

    return {
      message: 'Organization details updated successfully',
      updatedOrganization,
    };
  }

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
    if (role.name !== 'admin' && role.name !== 'moderator') {
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
