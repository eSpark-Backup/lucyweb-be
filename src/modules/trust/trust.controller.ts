import {
  Body,
  Controller,
  Post,
  UseGuards,
  Request,
  Get,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { TrustService } from './trust.service';
import { JwtAuthGuard } from 'src/common/guard/jwtAuth.guard';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Role } from 'src/common/schema/roles.enum';
import { Roles } from 'src/common/decorator/roles.decorator';
import { CreateSchoolDto } from '../users/dto/create-school.dto';
import { UserRegisterDto } from 'src/common/dto/userRegistrationDto';
import { UserService } from '../users/user.service';
import { UpdateSchoolDto } from './dto/UpdateSchoolDto';

@Controller('/trust')
export class TrustController {
  constructor(
    private readonly trustService: TrustService,
    private readonly userService: UserService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Roles(Role.TRUST)
  @Post('/add-school')
  async addSchool(@Request() req, @Body() dto: UserRegisterDto) {
    const trustId = req.user.id;
    return this.userService.registerUser(dto, trustId);
  }

  @Get('/schools')
  @UseGuards(JwtAuthGuard)
  @Roles(Role.TRUST)
  async getAllSchools(@Request() req) {
    const trustId = req.user.id;
    return this.trustService.getSchoolsByTrust(trustId);
  }

  @Patch('/update-school/:id')
  @UseGuards(JwtAuthGuard)
  @Roles(Role.TRUST)
  async updateSchool(
    @Param('id') id: string,
    @Body() dto: UpdateSchoolDto,
    @Request() req,
  ) {
    console.log('req', req.user);
    const trustId = req.user.id;
    return this.trustService.updateSchoolByTrust(trustId, +id, dto);
  }

  @Delete('/delete-school/:id')
  @UseGuards(JwtAuthGuard) 
  @Roles(Role.TRUST)
  async deleteSchool(@Param('id') id: string, @Request() req) {
    const trustId = req.user.id;
    return this.trustService.deleteSchoolByTrust(trustId, +id);
  }
}
