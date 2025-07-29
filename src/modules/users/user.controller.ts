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
} from '@nestjs/common';
import { UpdateRoleDto, UserService } from './user.service';
import { UserRegisterDto } from 'src/common/dto/userRegistrationDto';
import { JwtAuthGuard } from 'src/common/guard/jwtAuth.guard';
import { Roles } from 'src/common/decorator/roles.decorator';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Role } from 'src/common/schema/roles.enum';

@Controller('/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('/register')
  async createUser(
    @Body() userRegisterDto: UserRegisterDto,
  ): Promise<{ message: string }> {
    return this.userService.registerUser(userRegisterDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/me')
  async getProfileInfo(@Request() req): Promise<any> {
    const email = req.user.email;
    return this.userService.getUserProfile(email);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('/:id')
  async getUserById(@Request() req, @Param('id') userId: number): Promise<any> {
    const requester = req.user;
    return this.userService.getUserById(userId, requester);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN, Role.MODERATOR)
  @Patch('/:id')
  async updateUserById(
    @Request() req,
    @Param('id') userId: number,
    @Body() updateData: any,
  ): Promise<any> {
    const requester = req.user;
    return this.userService.updateUserById(userId, updateData, requester);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN, Role.MODERATOR)
  @Delete('/:id')
  async deleteUserById(
    @Request() req,
    @Param('id') userId: number,
  ): Promise<{ message: string }> {
    const requester = req.user;
    return this.userService.deleteUserById(userId, requester);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('/role/:email')
  async updateUserRole(
    @Request() req,
    @Param('email') email: string,
    @Body() role: UpdateRoleDto,
  ): Promise<{ message: string }> {
    return this.userService.updateUserRole(email, role.role);
  }
}
