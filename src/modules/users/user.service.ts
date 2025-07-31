import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRegisterDto } from 'src/common/dto/userRegistrationDto';
import { PrismaService } from 'src/prisma/prisma.service';

export interface UpdateRoleDto {
  role: number;
}

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async registerUser(
    userRegisterDto: UserRegisterDto,
  ): Promise<{ message: string }> {
    const { email, password, first_name, last_name, phone } = userRegisterDto;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        profile: {
          create: {
            first_name,
            last_name,
            phone,
          },
        },
      },
    });

    return { message: 'User registered successfully' };
  }

 async getUserProfile(email: string) {
  const user = await this.prisma.user.findUnique({
    where: { email },
    include: {
      profile: {
        include: {
          organization: true,
          role: true,
        },
      },
    },
  });

  if (!user || !user.profile) {
    throw new NotFoundException('User or profile not found');
  }

  return {
    email: user.email,
    first_name: user.profile.first_name,
    last_name: user.profile.last_name,
    phone: user.profile.phone,
    role: user.profile.role?.name,
    organization: user.profile.organization
      ? {
          name: user.profile.organization.name,
          address: user.profile.organization.address,
          subscriptionStatus:
            user.profile.organization.subscription_status,
        }
      : null,
  };
}

  async getUserById(userId: number, requester: any): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: {
          include: {
            organization: true,
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Owner can access all users
    if (requester.role === 'owner') {
      return this.formatUserResponse(user);
    }

    // Admin and Moderator can access only users in their organization
    if (
      (requester.role === 'admin' || requester.role === 'moderator') &&
      requester.organizationId === user.profile?.organization_id
    ) {
      return this.formatUserResponse(user);
    }

    throw new ForbiddenException('You do not have access to this resource');
  }

  async updateUserById(userId: number, updateData: any, requester: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: {
          include: {
            role: true, // Include role details for validation
            organization: true, // Include organization details
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Role-based access control
    const requesterRole = requester.role;
    if (requesterRole === 'ADMIN' || requesterRole === 'MODERATOR') {
      if (requester.organization_id !== user.profile?.organization_id) {
        throw new ForbiddenException(
          'Access denied: Not in the same organization',
        );
      }
    }

    if (requesterRole === 'MODERATOR' && updateData.role_id) {
      throw new ForbiddenException('Moderators cannot update roles');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        profile: {
          update: updateData,
        },
      },
    });

    return updatedUser;
  }

  async deleteUserById(
    userId: number,
    requester: any,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: {
          include: {
            role: true, // Include role details for validation
            organization: true, // Include organization details
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Role-based access control
    const requesterRole = requester.role;
    if (requesterRole === 'ADMIN' || requesterRole === 'MODERATOR') {
      if (requester.organization_id !== user.profile?.organization_id) {
        throw new ForbiddenException(
          'Access denied: Not in the same organization',
        );
      }
    }

    if (requesterRole === 'MODERATOR' && user.profile?.role?.name !== 'USER') {
      throw new ForbiddenException('Moderators cannot delete non-user roles');
    }

    await this.prisma.user.delete({
      where: { id: userId },
    });

    return { message: 'User deleted successfully' };
  }

  private formatUserResponse(user: any): any {
    return {
      email: user.email,
      fullName: `${user.profile?.first_name} ${user.profile?.last_name}`,
      phone: user.profile?.phone,
      role: user.profile?.role?.name,
      organization: user.profile?.organization
        ? {
            name: user.profile.organization.name,
            address: user.profile.organization.address,
            subscriptionStatus: user.profile.organization.subscription_status,
          }
        : null,
    };
  }

  async updateUserRole(
    email: string,
    roleId: number,
  ): Promise<{ message: string }> {
    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

    // Verify the role exists
    const roleExists = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!roleExists) {
      throw new NotFoundException(`Role with ID ${roleExists} not found`);
    }

    // Update the user's role through the profile
    await this.prisma.profile.update({
      where: { user_id: user.id },
      data: { role_id: roleId },
    });

    return {
      message: `Successfully updated role for user ${email} with new role ${roleExists.name}`,
    };
  }
}
