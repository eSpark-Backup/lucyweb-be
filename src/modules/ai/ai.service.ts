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
  ): Promise<{ content_types: string; text: string }[]> {
    const types = Array.isArray(contentTypes) ? contentTypes : [contentTypes];
    const results: { content_types: string; text: string }[] = [];

    // Loop to generate text for each content_type
    for (const type of types) {
      const prompt = this.constructPrompt(eventName, promptText, type);
      const maxTokens = this.getMaxTokens(type);

      try {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0,
          messages: [
            {
              role: 'system',
              content:
                'You are a professional content writer. ONLY use the information provided in the user prompt. Do NOT add or invent any dates, times, locations, names, emotional content, or extra details.',
            },
            { role: 'user', content: prompt },
          ],
          max_tokens: maxTokens,
        });

        this.totalRequests++;
        this.totalTokens += response.usage?.total_tokens || 0;

        let text = (response.choices[0].message.content || '').trim();
        if (!/[.!?]$/.test(text)) text += '.';

        results.push({ content_types: type, text });
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
      'Write in simple, clear, factual British English, in a neutral human tone. Use everyday words, avoid fancy, complex, or uncommon vocabulary. Do NOT invent names, staff, quotes, dates, times, locations, emotional content, or any details not explicitly provided in the prompt.';

    console.log('Content type received:', contentType);

    switch (contentType) {
      case 'press_release':
        return `${baseInstruction} Produce a detailed press release of more than 600 words (4 to 5 paragraphs) about "${promptText}" for the event titled "${eventName}". Do NOT create or fabricate teacher quotes, staff quotes, or any person’s name unless it is included in the description. Do NOT invent times, dates, locations, emotional content, or additional details. Don't use bold styling. Use simple and factual language, no complex words.`;

      case 'instagram_post':
        return `${baseInstruction} Create an engaging Instagram caption for "${eventName}" about "${promptText}". Include only the details explicitly provided. Do NOT invent content, emojis, hashtags, or any extra commentary. Don't use bold styling.`;

      case 'facebook_post':
        return `${baseInstruction} Create a Facebook post for "${eventName}" about "${promptText}". Include only the information explicitly provided. Do NOT invent content, calls to action, or extra commentary. Don't use bold styling.`;

      case 'newsletter':
        return `${baseInstruction} Write a more than 200-word newsletter paragraph about "${promptText}" for the event titled "${eventName}". Include only the details explicitly provided. Do NOT invent content or additional information. Don't use bold styling.`;

      case 'summary':
        return `${baseInstruction} Write a concise 2 to 3 sentence summary about "${promptText}" for the event titled "${eventName}". Include only the information explicitly provided. Do NOT invent content or additional details. Don't use bold styling.`;

      case 'governor_summary':
        return `${baseInstruction} Write a 2 to 3 sentence "Governor report summary" for the event titled "${eventName}". Summarize only the positive outcomes and achievements explicitly provided in the prompt. Do NOT invent content, details, or additional achievements. Make it factual and human-written. Don't use bold styling.`;

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
