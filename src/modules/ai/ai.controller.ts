import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from 'src/common/guard/jwtAuth.guard';
import { Roles } from 'src/common/decorator/roles.decorator';
import { Role } from 'src/common/schema/roles.enum';

@UseGuards(JwtAuthGuard)
@Roles(Role.ADMIN, Role.USER, Role.MODERATOR)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate')
  async generateContent(
    @Body('event_name') eventName: string,
    @Body('prompt_text') promptText: string,
    @Body('content_type') contentType: string,
  ): Promise<string> {
    return await this.aiService.generateContent(
      eventName,
      promptText,
      contentType,
    );
  }

  @Get('usage')
  async checkUsage(): Promise<any> {
    return await this.aiService.checkUsage();
  }
}
