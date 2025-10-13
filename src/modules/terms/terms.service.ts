import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class TermsService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrUpdateTerms(content: string) {
    const existing = await this.prisma.terms.findFirst();

    if (existing) {
      const updated = await this.prisma.terms.update({
        where: { id: existing.id },
        data: { content },
      });
      return { message: 'Terms updated successfully', data: updated };
    } else {
      const created = await this.prisma.terms.create({ data: { content } });
      return { message: 'Terms created successfully', data: created };
    }
  }

  async getLatestTerms() {
    const terms = await this.prisma.terms.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!terms) throw new NotFoundException('No terms found');

    return { message: 'Terms fetched successfully', data: terms };
  }
}
