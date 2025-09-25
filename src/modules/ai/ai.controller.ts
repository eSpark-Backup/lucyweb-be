import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from 'src/common/guard/jwtAuth.guard';
import { Roles } from 'src/common/decorator/roles.decorator';
import { Role } from 'src/common/schema/roles.enum';

@UseGuards(JwtAuthGuard)
@Roles(Role.ADMIN, Role.USER, Role.MODERATOR, Role.SCHOOL)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /**
   * Accepts a single content_type or an array of content types.
   * Example:
   * {
   *   "event_name": "Carbon Emission Awareness",
   *   "prompt_text": "Generate a text about carbon emission reduction",
   *   "content_type": ["newsletter","press_release","governor_summary"]
   * }
   */
  @Post('generate')
  async generateContent(
    @Body('event_name') eventName: string,
    @Body('prompt_text') promptText: string,
    @Body('content_types') contentTypes: string | string[],
  ): Promise<{ content_types: string; text: string }[]> {
    return this.aiService.generateContent(eventName, promptText, contentTypes);
  }

  @Get('usage')
  async checkUsage(): Promise<any> {
    return this.aiService.checkUsage();
  }
}
