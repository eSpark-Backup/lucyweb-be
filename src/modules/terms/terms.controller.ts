import { Controller, Get, Post, Body } from '@nestjs/common';
import { TermsService } from './terms.service';

@Controller('terms-and-conditions')
export class TermsController {
  constructor(private readonly termsService: TermsService) {}

  @Post()
  async createOrUpdateTerms(
    @Body('content') content: string,
    @Body('termsAndConditions')
    termsAndConditions: { title: string; content: string }[],
  ) {
    return this.termsService.createOrUpdateTerms(content, termsAndConditions);
  }

  @Get()
  async getTerms() {
    const latestTerms = await this.termsService.getLatestTerms();

    return {
      success: true,
      message: 'Latest Terms and Conditions fetched successfully.',
      data: latestTerms.data,
    };
  }
}
