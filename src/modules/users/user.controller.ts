import {
  Body,
  Controller,
  Post,
  Get,
  UseGuards,
  Request,
  Param,
  Patch,
  Delete,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { UserService, UpdateRoleDto } from './user.service';
import { UserRegisterDto } from 'src/common/dto/userRegistrationDto';
import { JwtAuthGuard } from 'src/common/guard/jwtAuth.guard';
import { Roles } from 'src/common/decorator/roles.decorator';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Role } from 'src/common/schema/roles.enum';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('/register')
  async registerUser(
    @Body() userRegisterDto: UserRegisterDto,
  ): Promise<{ message: string; token: string }> {
    return this.userService.registerUser(userRegisterDto);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.SCHOOL, Role.USER, Role.ADMIN, Role.MODERATOR)
  @Get('/me')
  async getProfile(@Request() req): Promise<any> {
    return this.userService.getUserProfile(req.user.email);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('/me')
  @UseInterceptors(FileInterceptor('profile_image'))
  async updateProfile(
    @Request() req,
    @Body() updateData: any,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<any> {
    return this.userService.updateUserProfile(req.user.id, updateData, file);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('/:id')
  async getUserById(@Request() req, @Param('id') userId: number): Promise<any> {
    return this.userService.getUserById(Number(userId), req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN, Role.MODERATOR)
  @Patch('/:id')
  async updateUserById(
    @Request() req,
    @Param('id') userId: number,
    @Body() updateData: any,
  ): Promise<any> {
    return this.userService.updateUserById(
      Number(userId),
      updateData,
      req.user,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN, Role.MODERATOR)
  @Delete('/:id')
  async deleteUserById(
    @Request() req,
    @Param('id') userId: number,
  ): Promise<{ message: string }> {
    return this.userService.deleteUserById(Number(userId), req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @Patch('/role/:email')
  async updateUserRole(
    @Param('email') email: string,
    @Body() role: UpdateRoleDto,
  ): Promise<{ message: string }> {
    return this.userService.updateUserRole(email, role.role);
  }
}
