import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class AiService {
  private openai: OpenAI;
  private totalRequests = 0;
  private totalTokens = 0;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Accepts one or multiple content types and returns
   * an array of objects with each content_type and its generated text.
   */
  async generateContent(
    eventName: string,
    promptText: string,
    contentTypes: string | string[],
  ): Promise<{ content_type: string; text: string }[]> {
    const types = Array.isArray(contentTypes) ? contentTypes : [contentTypes];
    const results: { content_type: string; text: string }[] = [];

    // Loop to generate text for each content_type
    for (const type of types) {
      const prompt = this.constructPrompt(eventName, promptText, type);
      const maxTokens = this.getMaxTokens(type);

      try {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.8,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
        });

        this.totalRequests++;
        this.totalTokens += response.usage?.total_tokens || 0;

        let text = (response.choices[0].message.content || '').trim();
        if (!/[.!?]$/.test(text)) text += '.';

        results.push({ content_type: type, text });
      } catch (error) {
        console.error(`Error generating content for ${type}:`, error);
        throw new Error(`Failed to generate content for type: ${type}`);
      }
    }

    return results;
  }

  /** Build the prompt text for OpenAI based on content type */
  private constructPrompt(
    eventName: string,
    promptText: string,
    contentType: string,
  ): string {
    const baseInstruction =
      'Write in natural, conversational British English that sounds human-written. Avoid generic AI phrasing and add small, realistic details where appropriate.';
    console.log('Content type received:', contentType);

    switch (contentType) {
      case 'press_release':
        return `${baseInstruction} Produce a detailed press release of more than 600 words (4 to 5 paragraphs) about "${promptText}" for the event titled "${eventName}". Don't use bold styling.`;
      case 'instagram_post':
        return `${baseInstruction} Create an engaging Instagram caption for "${eventName}" about "${promptText}". Use a friendly tone, relevant emojis, and popular hashtags. Don't use bold styling.`;
      case 'facebook_post':
        return `${baseInstruction} Create a Facebook post for "${eventName}" about "${promptText}". Use a community-oriented tone and include a call to action. Don't use bold styling.`;
      case 'newsletter':
        return `${baseInstruction} Write a more than 200-word newsletter paragraph about "${promptText}" for the event titled "${eventName}". Don't use bold styling.`;
      case 'summary':
        return `${baseInstruction} Write a concise 2 to 3 sentence summary about "${promptText}" for the event titled "${eventName}". Don't use bold styling.`;
      case 'governor_summary':
        return `${baseInstruction} Provide an authoritative yet approachable 2 to 3 sentence briefing for the governor about "${promptText}" regarding the event titled "${eventName}". Don't use bold styling.`;
      default:
        throw new Error('Invalid content type');
    }
  }

  /** Set token limits according to the content type */
  private getMaxTokens(contentType: string): number {
    switch (contentType) {
      case 'press_release':
        return 1000;
      case 'instagram_post':
      case 'facebook_post':
        return 250;
      case 'newsletter':
        return 350;
      case 'governor_summary':
      case 'summary':
        return 150;
      default:
        return 150;
    }
  }

  /** Track and return total request/token usage */
  async checkUsage(): Promise<any> {
    return {
      status: 'ok',
      data: {
        total_requests: this.totalRequests,
        total_tokens_used: this.totalTokens,
      },
    };
  }
}
