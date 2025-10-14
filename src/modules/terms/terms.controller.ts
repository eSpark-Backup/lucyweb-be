import { Controller, Get /*,  Post, Body,  UseGuards */ } from '@nestjs/common';
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
  // @Post()
  // async createOrUpdateTerms(@Body('content') content: string) {
  //   return this.termsService.createOrUpdateTerms(content);
  // }

  @Get()
  async getTerms() {
    return this.termsService.getLatestTerms();
  }
}
