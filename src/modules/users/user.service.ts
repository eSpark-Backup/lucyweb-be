import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRegisterDto } from 'src/common/dto/userRegistrationDto';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { EmailService } from '../email/email.service';
import { User } from '@prisma/client';

export interface UpdateRoleDto {
  role: number;
}

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly emailService: EmailService,
  ) {}

  async registerUser(
    userRegisterDto: UserRegisterDto,
    trustIdFromJWT?: number,
  ): Promise<{ message: string }> {
    const {
      email,
      password,
      first_name,
      last_name,
      phone,
      role,
      school_name,
      school_type,
      school_city,
      school_region,
      school_country,
      school_user_position,
    } = userRegisterDto;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification token and expiration time
    const verificationToken = this.emailService.generateVerificationToken();
    const verificationExpires = new Date();
    verificationExpires.setHours(verificationExpires.getHours() + 24);

    // Look up role ID from roles table
    const userRole = await this.prisma.role.findUnique({
      where: { name: role ?? 'User' },
    });

    if (!userRole) {
      throw new BadRequestException(`Invalid role: ${role}`);
    }

    if (trustIdFromJWT && role?.toUpperCase() === 'TRUST') {
      throw new BadRequestException('Trust cannot be created with parent');
    }

    // Create user and profile
    await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        email_verified: false,
        email_verification_token: verificationToken,
        email_verification_expires: verificationExpires,
        // ✅ Use connect if trustIdFromJWT is available
        ...(role?.toUpperCase() !== 'TRUST' && trustIdFromJWT
          ? { trust: { connect: { id: trustIdFromJWT } } }
          : {}),

        role: { connect: { id: userRole.id } }, // ✅ good
        profile: {
          create: {
            first_name,
            last_name,
            phone,
            role_id: userRole.id,
            school_name:
              role?.toUpperCase() !== 'TRUST' ? school_name : undefined,
            school_type:
              role?.toUpperCase() !== 'TRUST' ? school_type : undefined,
            school_city:
              role?.toUpperCase() !== 'TRUST' ? school_city : undefined,
            school_region:
              role?.toUpperCase() !== 'TRUST' ? school_region : undefined,
            school_country:
              role?.toUpperCase() !== 'TRUST' ? school_country : undefined,
            school_user_position:
              role?.toUpperCase() !== 'TRUST'
                ? school_user_position
                : undefined,
          },
        },
      },
    });

    // Send verification email with different content based on role
    if (role?.toUpperCase() === 'TRUST') {
      await this.emailService.sendVerificationEmailForTrust(
        email,
        verificationToken,
        first_name,
      );
    } else {
      await this.emailService.sendVerificationEmail(
        email,
        verificationToken,
        first_name,
      );
    }

    return {
      message:
        'Registration successful! Please check your email to verify your account.',
    };
  }

  // Verify email method
  async verifyEmail(token: string): Promise<{ message: string }> {
    if (!token) {
      throw new BadRequestException('Verification token is required');
    }

    const user = await this.prisma.user.findUnique({
      where: { email_verification_token: token },
      include: { profile: true },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    // Check if token is expired
    if (
      user.email_verification_expires &&
      user.email_verification_expires < new Date()
    ) {
      throw new BadRequestException('Verification token has expired');
    }

    // Check if already verified
    if (user.email_verified) {
      throw new BadRequestException('Email is already verified');
    }

    // Update user as verified
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        email_verified: true,
        email_verification_token: null,
        email_verification_expires: null,
      },
    });

    // Send welcome email
    await this.emailService.sendWelcomeEmail(
      user.email,
      user.profile?.first_name,
    );

    return {
      message: 'Email verified successfully! Welcome to our platform.',
    };
  }

  // Resend verification email
  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.email_verified) {
      throw new BadRequestException('Email is already verified');
    }

    // Generate new verification token
    const verificationToken = this.emailService.generateVerificationToken();
    const verificationExpires = new Date();
    verificationExpires.setHours(verificationExpires.getHours() + 24);

    // Update user with new token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        email_verification_token: verificationToken,
        email_verification_expires: verificationExpires,
      },
    });

    // Send verification email
    await this.emailService.sendVerificationEmail(
      email,
      verificationToken,
      user.profile?.first_name,
    );

    return {
      message: 'Verification email sent! Please check your email.',
    };
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: { email },
      include: {
        profile: true,
      },
    });
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
      fullName: `${user.profile?.first_name} ${user.profile?.last_name}`,

      phone: user.profile.phone,
      profile_image: user.profile.profile_image,
      role: user.profile.role?.name,
      organization: user.profile.organization
        ? {
            name: user.profile.organization.name,
            address: user.profile.organization.address,
            subscriptionStatus: user.profile.organization.subscription_status,
          }
        : null,
    };
  }

  async getUserById(userId: number, requester: any): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: Number(userId) },
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
    const idAsNumber = Number(userId);
    const user = await this.prisma.user.findUnique({
      where: {
        id: idAsNumber,
      },
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

  async updateUserProfile(
    userId: number,
    updateData: any,
    file?: Express.Multer.File,
  ): Promise<any> {
    if ('email' in updateData) {
      delete updateData.email;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (file) {
      const imageUrl = await this.storageService.uploadFile(file);
      updateData.profile_image = imageUrl;
    }

    const updated = await this.prisma.profile.update({
      where: { user_id: userId },
      data: updateData,
    });

    return {
      message: 'Profile updated successfully',
      updated,
    };
  }
}
