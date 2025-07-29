import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from 'src/common/schema/roles.enum';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // Create a new question
  async createQuestion(
    text: string,
    question_type: string,
    options?: string[],
    requester?: any,
  ): Promise<{ message: string; id: number }> {
    if (
      requester &&
      requester.role.toLowerCase() !== Role.OWNER &&
      requester.role !== Role.ADMIN
    ) {
      throw new ForbiddenException('Only OWNER or ADMIN can manage questions');
    }

    const question = await this.prisma.question.create({
      data: {
        text,
        question_type,
        options: options ? JSON.stringify(options) : null,
        is_archived: false,
        created_by: requester.id, // Tie the question to the admin who created it
      },
    });
    return { message: 'Question created successfully', id: question.id };
  }

  // Update an existing question
  async updateQuestion(
    questionId: number,
    text: string,
    question_type: string,
    options?: string[],
    is_archived?: boolean,
    requester?: any,
  ): Promise<{ message: string; id: number }> {
    if (
      requester &&
      requester.role.toLowerCase() !== Role.OWNER &&
      requester.role !== Role.ADMIN
    ) {
      throw new ForbiddenException('Only OWNER or ADMIN can update questions');
    }

    const existing = await this.prisma.question.findUnique({
      where: { id: Number(questionId) },
    });
    if (!existing) {
      throw new NotFoundException(`Question with ID ${questionId} not found`);
    }

    const updated = await this.prisma.question.update({
      where: { id: Number(questionId) },
      data: {
        text,
        question_type,
        options: options ? JSON.stringify(options) : null,
        is_archived:
          is_archived !== undefined ? is_archived : existing.is_archived,
      },
    });
    return { message: 'Question updated successfully', id: updated.id };
  }

  // Archive a question
  async archiveQuestion(
    questionId: number,
    requester: any,
  ): Promise<{ message: string }> {
    if (
      requester.role.toLowerCase() !== Role.OWNER &&
      requester.role !== Role.ADMIN
    ) {
      throw new ForbiddenException('Only OWNER or ADMIN can archive questions');
    }

    const question = await this.prisma.question.findUnique({
      where: { id: Number(questionId) },
    });
    if (!question) {
      throw new NotFoundException(`Question with ID ${questionId} not found`);
    }

    await this.prisma.question.update({
      where: { id: Number(questionId) },
      data: { is_archived: true },
    });
    return { message: `Question ${questionId} archived successfully` };
  }

  // Get all non-archived questions
  async getAllQuestions(): Promise<
    { id: number; text: string; question_type: string; options?: string[] }[]
  > {
    const questions = await this.prisma.question.findMany({
      where: { is_archived: false },
    });

    return questions.map((q) => ({
      id: q.id,
      text: q.text,
      question_type: q.question_type,
      options: q.options ? JSON.parse(q.options as string) : undefined,
    }));
  }

  // Submit responses (can be empty, but requires email)
  // Add to AdminService
  async createInitialResponse(
    email: string,
  ): Promise<{ message: string; responseId: number }> {
    if (!email) {
      throw new ForbiddenException('Email is required to create a response');
    }

    const existingResponse = await this.prisma.response.findFirst({
      where: { email },
    });
    if (existingResponse) {
      throw new ForbiddenException('A response for this email already exists');
    }

    const response = await this.prisma.response.create({
      data: { email },
    });

    return {
      message: 'Response created successfully',
      responseId: response.id,
    };
  }

  async updateResponseWithAnswer(
    responseId: number,
    answers: { questionId: number; answer_text: string }[],
  ): Promise<{ message: string }> {
    const response = await this.prisma.response.findUnique({
      where: { id: Number(responseId) },
    });
    if (!response) {
      throw new NotFoundException(`Response with ID ${responseId} not found`);
    }

    for (const { questionId, answer_text } of answers) {
      const question = await this.prisma.question.findUnique({
        where: { id: Number(questionId), is_archived: false },
      });
      if (!question) {
        throw new NotFoundException(
          `Question with ID ${questionId} not found or is archived`,
        );
      }

      await this.prisma.answer.upsert({
        where: {
          response_id_question_id: {
            response_id: Number(responseId),
            question_id: Number(questionId),
          },
        },
        update: { answer_text },
        create: {
          response_id: Number(responseId),
          question_id: Number(questionId),
          answer_text,
        },
      });
    }

    return { message: 'Answers updated successfully' };
  }

  // Get all responses
  async getResponses(requester: any): Promise<any> {
    if (
      requester.role.toLowerCase() !== Role.OWNER &&
      requester.role !== Role.ADMIN
    ) {
      throw new ForbiddenException('Only OWNER or ADMIN can view responses');
    }

    const responses = await this.prisma.response.findMany({
      include: {
        answers: {
          include: { question: true },
        },
      },
    });

    return responses.map((response) => ({
      email: response.email,
      submitted_at: response.submitted_at,
      answers: response.answers.map((answer) => ({
        question_id: answer.question_id,
        question_text: answer.question.text,
        answer_text: answer.answer_text,
        is_archived: answer.question.is_archived,
      })),
    }));
  }

  // Get all respondents
  async getRespondents(
    requester: any,
  ): Promise<{ respondents: { email: string; submitted_at: Date }[] }> {
    if (
      requester.role.toLowerCase() !== Role.OWNER &&
      requester.role !== Role.ADMIN
    ) {
      throw new ForbiddenException('Only OWNER or ADMIN can view respondents');
    }

    const responses = await this.prisma.response.findMany();
    return {
      respondents: responses.map((response) => ({
        email: response.email,
        submitted_at: response.submitted_at,
      })),
    };
  }
}
