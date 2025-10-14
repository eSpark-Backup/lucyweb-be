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
import { JwtService } from '@nestjs/jwt';

export interface UpdateRoleDto {
  role: number;
}

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
  ) {}

  async registerUser(userRegisterDto: UserRegisterDto): Promise<{
    success: boolean;
    message: string;
    data: {
      token: string;
      user: { id: number; email: string; termsAccepted: boolean };
    };
  }> {
    const { email, password, first_name, last_name, phone, role } =
      userRegisterDto;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const verificationToken = this.emailService.generateVerificationToken();
    const verificationExpires = new Date();
    verificationExpires.setHours(verificationExpires.getHours() + 24);

    let roleId: number;
    if (role) {
      const roleRecord = await this.prisma.role.findFirst({
        where: {
          name: { equals: role.toLowerCase(), mode: 'insensitive' },
        },
      });
      if (!roleRecord) {
        throw new BadRequestException(`Invalid role: ${role}`);
      }
      roleId = roleRecord.id;
    } else {
      roleId = 4;
    }

    const newUser = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        email_verified: false,
        termsAccepted: false, // ✅ initialize termsAccepted
        email_verification_token: verificationToken,
        email_verification_expires: verificationExpires,
        role: { connect: { id: roleId } },
        profile: {
          create: {
            first_name,
            last_name,
            phone,
            role: { connect: { id: roleId } },
          },
        },
      },
      include: { role: true, profile: { include: { role: true } } },
    });

    await this.emailService.sendVerificationEmail(
      email,
      verificationToken,
      first_name,
    );

    const token = this.jwtService.sign(
      {
        id: newUser.id,
        email: newUser.email,
        role: newUser.profile?.role?.name.toLowerCase(),
      },
      {
        secret: process.env.JWT_SECRET,
        expiresIn: '1d',
      },
    );

    return {
      success: true,
      message:
        'Registration successful! Please check your email to verify your account.',
      data: {
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          termsAccepted: newUser.termsAccepted, // ✅ included in response
        },
      },
    };
  }

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

    const verificationToken = this.emailService.generateVerificationToken();
    const verificationExpires = new Date();
    verificationExpires.setHours(verificationExpires.getHours() + 24);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        email_verification_token: verificationToken,
        email_verification_expires: verificationExpires,
      },
    });

    await this.emailService.sendVerificationEmail(
      email,
      verificationToken,
      user.profile?.first_name,
    );

    return { message: 'Verification email sent! Please check your email.' };
  }

  async findUserByEmail(email: string): Promise<Partial<User> | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true, role: true },
    });

    if (!user) return null;

    return this.sanitizeUser(user);
  }

  async getUserProfile(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        profile: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                is_trust: true,
                trust_locked: true,
                selected_school_count: true,
              },
            },
            role: true,
          },
        },
        school: {
          select: {
            id: true,
            name: true,
            email: true,
            is_paid: true,
            image: true,
            organization: {
              select: {
                id: true,
                name: true,
                is_trust: true,
                trust_locked: true,
                selected_school_count: true,
              },
            },
          },
        },
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // if both profile and school are missing → invalid user
    if (!user.profile && !user.school) {
      throw new NotFoundException('User or profile/school not found');
    }

    return this.sanitizeUser(user);
  }

  async getUserById(userId: number, requester: any): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: Number(userId) },
      include: {
        profile: { include: { organization: true, role: true } },
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (requester.role === 'owner') {
      return this.sanitizeUser(user);
    }

    if (
      (requester.role === 'admin' || requester.role === 'moderator') &&
      requester.organizationId === user.profile?.organization_id
    ) {
      return this.sanitizeUser(user);
    }

    throw new ForbiddenException('You do not have access to this resource');
  }

  async updateUserById(userId: number, updateData: any, requester: any) {
    const idAsNumber = Number(userId);
    const user = await this.prisma.user.findUnique({
      where: { id: idAsNumber },
      include: {
        profile: { include: { role: true, organization: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

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
      data: { profile: { update: updateData } },
      include: { profile: true, role: true },
    });

    return this.sanitizeUser(updatedUser);
  }

  async deleteUserById(
    userId: number,
    requester: any,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: { include: { role: true, organization: true } } },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

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

    await this.prisma.user.delete({ where: { id: userId } });

    return { message: 'User deleted successfully' };
  }

  async updateUserRole(
    email: string,
    roleId: number,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

    const roleExists = await this.prisma.role.findUnique({
      where: { id: roleId },
    });
    if (!roleExists) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

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
      include: { profile: true, role: true },
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
      updated: {
        ...updated,
        email: user.email,
        role: user.role?.name,
      },
    };
  }

  private sanitizeUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      email_verified: user.email_verified,
      created_at: user.created_at,
      updated_at: user.updated_at,
      role: user.role?.name || user.profile?.role?.name || 'school',

      profile: user.profile
        ? {
            first_name: user.profile.first_name,
            last_name: user.profile.last_name,
            phone: user.profile.phone,
            profile_image: user.profile.profile_image,
            organization: user.profile.organization
              ? {
                  name: user.profile.organization.name,
                  address: user.profile.organization.address,
                  subscriptionStatus:
                    user.profile.organization.subscription_status,
                  is_trust: user.profile.organization.is_trust ?? false,
                }
              : null,
          }
        : null,

      school: user.school
        ? {
            id: user.school.id,
            name: user.school.name,
            email: user.school.email,
            is_paid: user.school.is_paid,
            image: user.school.image,
            organization: user.school.organization
              ? {
                  id: user.school.organization.id,
                  name: user.school.organization.name,
                  is_trust: user.school.organization.is_trust,
                  trust_locked: user.school.organization.trust_locked,
                  selected_school_count:
                    user.school.organization.selected_school_count,
                }
              : null,
          }
        : null,
    };
  }
}
