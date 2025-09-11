import {
  Body,
  Controller,
  Post,
  UseGuards,
  Request,
  Get,
  Patch,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guard/jwtAuth.guard';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from 'src/common/dto/organizationCreateDto';
import { Roles } from 'src/common/decorator/roles.decorator';
import { Role } from 'src/common/schema/roles.enum';

@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN, Role.MODERATOR, Role.USER)
  @Post('/create')
  async createOrganization(
    @Body() createOrganizationDto: CreateOrganizationDto,
    @Request() req: any,
  ): Promise<{ message: string }> {
    const email = req.user.email;
    return this.organizationService.createOrganization(
      createOrganizationDto,
      email,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN, Role.MODERATOR, Role.USER)
  @Get('/me')
  async getOrganizationDetails(@Request() req: any) {
    const { email, role } = req.user;
    return this.organizationService.getOrganizationDetailsByEmail(email, role);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN, Role.MODERATOR, Role.USER)
  @Patch('/update')
  async updateOrganization(
    @Body() updateData: { name?: string; address?: string },
    @Request() req: any,
  ): Promise<{ message: string; updatedOrganization: any }> {
    const email = req.user.email;
    return this.organizationService.updateOrganizationDetails(
      email,
      updateData,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN, Role.MODERATOR)
  @Get('/users')
  async getOrganizationUsers(
    @Request() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ): Promise<any> {
    const email = req.user.email;
    return this.organizationService.getUsersByOrganization(
      email,
      Number(page),
      Number(limit),
    );
  }
}
