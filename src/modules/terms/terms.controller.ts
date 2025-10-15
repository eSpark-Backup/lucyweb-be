import { Controller, Get, Post, Body /* UseGuards */ } from '@nestjs/common';
import { TermsService } from './terms.service';
// import { JwtAuthGuard } from 'src/common/guard/jwtAuth.guard';
// import { RolesGuard } from 'src/common/guard/roles.guard';
// import { Roles } from 'src/common/decorator/roles.decorator';
// import { Role } from 'src/common/schema/roles.enum';

@Controller('terms-and-conditions')
export class TermsController {
  constructor(private readonly termsService: TermsService) {}

  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.ADMIN, Role.OWNER)
  @Post()
  async createOrUpdateTerms(@Body('content') content: string) {
    return this.termsService.createOrUpdateTerms(content);
  }

  @Get()
  async getTerms() {
    const latestTerms = await this.termsService.getLatestTerms();

    const termsAndConditions = [
      {
        title: 'Acceptance of Terms',
        content: `By accessing or using Edupulse, you confirm that you have read, understood,
and agree to be bound by this Agreement. If you do not agree with these Terms
and Conditions, you must not use the Service.`,
      },
    ];

    return {
      success: true,
      message: 'Latest Terms and Conditions fetched successfully.',
      data: latestTerms.data,
      termsAndConditions,
    };
  }
}
