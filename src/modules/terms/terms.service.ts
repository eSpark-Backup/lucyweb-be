import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class TermsService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrUpdateTerms(
    content: string,
    sections: { title: string; content: string }[],
  ) {
    const existing = await this.prisma.termsAndConditions.findFirst();

    if (existing) {
      const updated = await this.prisma.termsAndConditions.update({
        where: { id: existing.id },
        data: {
          content,
          sections,
        },
      });
      return {
        success: true,
        message: 'Terms and Conditions updated successfully.',
        data: updated,
      };
    } else {
      const created = await this.prisma.termsAndConditions.create({
        data: {
          content,
          sections,
        },
      });
      return {
        success: true,
        message: 'Terms and Conditions created successfully.',
        data: created,
      };
    }
  }

  async getLatestTerms() {
    const latest = await this.prisma.termsAndConditions.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!latest) throw new NotFoundException('No Terms and Conditions found.');

    return {
      success: true,
      message: 'Terms and Conditions fetched successfully.',
      data: latest,
    };
  }
}
