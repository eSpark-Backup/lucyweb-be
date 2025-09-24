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

  async generateContent(
    eventName: string,
    promptText: string,
    contentType: string,
  ): Promise<string> {
    const prompt = this.constructPrompt(eventName, promptText, contentType);
    const maxTokens = this.getMaxTokens(contentType);

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.8, // encourage natural, human-like variety
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
      });

      this.totalRequests++;
      this.totalTokens += response.usage?.total_tokens || 0;

      // Ensure we return a complete sentence
      let text = (response.choices[0].message.content || '').trim();
      if (!/[.!?]$/.test(text)) text += '.';
      return text;
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
    const baseInstruction =
      'Write in natural, conversational British English that sounds human-written. Avoid generic AI phrasing and add small, realistic details where appropriate.';
    console.log('Content type received:', contentType);

    switch (contentType) {
      case 'press_release':
        return `${baseInstruction} Produce a detailed press release of more than 600 words (around 4 to 5 paragraphs) about "${promptText}" for the event titled "${eventName}".`;
      case 'instagram_post':
        return `${baseInstruction} Create an engaging Instagram caption for "${eventName}" about "${promptText}". Use a friendly tone, relevant emojis, and popular hashtags to suit Instagram culture.`;
      case 'facebook_post':
        return `${baseInstruction} Create a Facebook post for "${eventName}" about "${promptText}". Use a community-oriented tone and include a call to action.`;
      case 'newsletter':
        return `${baseInstruction} Write more than 200-words newsletter paragraph about "${promptText}" for the event titled "${eventName}".`;
      case 'summary':
        return `${baseInstruction} Write a concise 2 to 3 sentence summary about "${promptText}" for the event titled "${eventName}".`;
      case 'governor_summary':
        return `${baseInstruction} Provide an authoritative yet approachable summary for a briefing of governor about "${promptText}" regarding the event titled "${eventName}". Limit to 2 to 3 sentences.`;
      default:
        throw new Error('Invalid content type');
    }
  }

  private getMaxTokens(contentType: string): number {
    switch (contentType) {
      case 'press_release':
        return 1000; // enough for 600+ words
      case 'instagram_post':
      case 'facebook_post':
        return 250; // longer captions without truncation
      case 'newsletter':
        return 350;
      case 'governor_summary':
      case 'summary':
        return 150;
      default:
        return 150;
    }
  }

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
