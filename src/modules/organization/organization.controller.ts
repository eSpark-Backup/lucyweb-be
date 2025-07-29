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
  @Post('/create')
  async createOrganization(
    @Body() createOrganizationDto: CreateOrganizationDto,
    @Request() req,
  ): Promise<{ message: string }> {
    const email = req.user.email; // Extract email from the JWT
    return this.organizationService.createOrganization(
      createOrganizationDto,
      email,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('/me')
  async getOrganizationDetails(@Request() req) {
    const { email, role } = req.user;
    // Fetch organization details for the requesting user's email
    return this.organizationService.getOrganizationDetailsByEmail(email, role);
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @Patch('/update')
  async updateOrganization(
    @Body() updateData: { name?: string; address?: string },
    @Request() req: any,
  ): Promise<{ message: string; updatedOrganization: any }> {
    const email = req.user.email; // Email from decoded token
    return this.organizationService.updateOrganizationDetails(
      email,
      updateData,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Roles(Role.OWNER, Role.ADMIN, Role.MODERATOR) // Only Admin and Moderator can access this API
  @Get('/users')
  async getOrganizationUsers(
    @Request() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ): Promise<any> {
    const email = req.user.email; // Email from JWT token
    return this.organizationService.getUsersByOrganization(email, page, limit);
  }
}
