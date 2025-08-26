import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class AiService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateContent(
    eventName: string,
    promptText: string,
    contentType: string,
  ): Promise<string> {
    const prompt = this.constructPrompt(eventName, promptText, contentType);
    const maxTokens = this.getMaxTokens(contentType);

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error generating content: ', error);
      throw new Error('Failed to generate content.');
    }
  }

  private constructPrompt(
    eventName: string,
    promptText: string,
    contentType: string,
  ): string {
    const styleInstruction =
      'Use British English spelling and a neutral, professional tone.';
    console.log('Content type received:', contentType);

    switch (contentType) {
      case 'press_release':
        return `${styleInstruction} Write a 3-paragraph, 600-word press release about "${promptText}" for the event titled "${eventName}".`;
      case 'instagram_post':
        return `${styleInstruction} Write an Instagram post about "${promptText}" for the event titled "${eventName}".`;
      case 'facebook_post':
        return `${styleInstruction} Write a Facebook post about "${promptText}" for the event titled "${eventName}".`;
      case 'newsletter':
        return `${styleInstruction} Write a 100-word paragraph about "${promptText}" for the event titled "${eventName}".`;
      case 'summary':
        return `${styleInstruction} Write a concise 2-3 sentence summary about "${promptText}" for the event titled "${eventName}".`;
      default:
        throw new Error('Invalid content type');
    }
  }

  private getMaxTokens(contentType: string): number {
    switch (contentType) {
      case 'press_release':
        return 600; // Adjust the max tokens based on your needs
      case 'instagram_post':
      case 'facebook_post':
        return 150; // Assuming short posts
      case 'newsletter':
        return 100; // Short paragraph
      default:
        return 100; // Default to 100 if type is unknown
    }
  }

  async checkUsage(): Promise<any> {
    // Implement billing-related API logic if necessary
    throw new Error('Usage checking has not been implemented.');
  }
}
