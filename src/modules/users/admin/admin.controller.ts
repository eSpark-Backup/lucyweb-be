import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guard/jwtAuth.guard';
import { Roles } from 'src/common/decorator/roles.decorator';
import { RolesGuard } from 'src/common/guard/roles.guard';
import { Role } from 'src/common/schema/roles.enum';
import { AdminService } from './admin.service';

@Controller('/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @Post('/questions/create')
  async createQuestion(
    @Request() req,
    @Body('text') text: string,
    @Body('question_type') question_type: string,
    @Body('options') options?: string[],
  ) {
    return this.adminService.createQuestion(
      text,
      question_type,
      options,
      req.user,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @Patch('/questions/update/:id')
  async updateQuestion(
    @Request() req,
    @Param('id') id: number,
    @Body('text') text: string,
    @Body('question_type') question_type: string,
    @Body('options') options?: string[],
    @Body('is_archived') is_archived?: boolean,
  ) {
    return this.adminService.updateQuestion(
      id,
      text,
      question_type,
      options,
      is_archived,
      req.user,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @Patch('/questions/archive/:id')
  async archiveQuestion(@Request() req, @Param('id') id: number) {
    return this.adminService.archiveQuestion(id, req.user);
  }

  @Get('/questions')
  async getAllQuestions() {
    return this.adminService.getAllQuestions();
  }

  @Post('/responses/create')
  async createInitialResponse(@Body('email') email: string) {
    return this.adminService.createInitialResponse(email);
  }

  @Patch('/responses/:id/answer')
  async updateResponseWithAnswer(
    @Param('id') id: number,
    @Body() body: { answers: { questionId: number; answer_text: string }[] },
  ) {
    return this.adminService.updateResponseWithAnswer(id, body.answers);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @Get('/responses')
  async getResponses(@Request() req) {
    return this.adminService.getResponses(req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @Get('/respondents')
  async getRespondents(@Request() req) {
    return this.adminService.getRespondents(req.user);
  }
}
