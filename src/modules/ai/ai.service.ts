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
          model: 'gpt-4o',
          temperature: 0.6,
          messages: [
            {
              role: 'system',
              content:
                'You are a professional education-sector content writer. Use ONLY the facts provided, but you may adapt, rephrase, summarise, and format them appropriately for the requested platform. Do NOT invent dates, times, locations, names, or events that are not stated.',
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
        return `${baseInstruction}
Write a brief, factual press release-style description (150–200 words) of the event titled "${eventName}" using the following description:
"${promptText}"

Purpose:
- This is a short public description, NOT a long-form article
- Neutral, factual tone
- Past tense
- No quotes
- No invented details
- Do not repeat the description word-for-word
`;

      case 'instagram_post':
        return `${baseInstruction}
Create an engaging Instagram caption for the event "${eventName}" based on:
"${promptText}"

Rules:
- Friendly, upbeat tone
- Use relevant emojis
- Include 5–8 relevant hashtags at the end
- Do NOT invent dates, names, or locations
- Adapt the wording; do not copy the description
`;

      case 'facebook_post':
        return `${baseInstruction}
Create a Facebook post for parents and the school community about the event "${eventName}" using:
"${promptText}"

Rules:
- Warm, informative tone
- Include 3–5 relevant hashtags at the end
- Minimal use of emojis (optional, if it fits naturally)
- Written as a short community update
- Adapt the wording; do not copy the description text verbatim
- Do not invent dates, names, or locations
`;

      case 'newsletter':
        return `${baseInstruction}
Write a newsletter article (150–200 words) for parents about the event "${eventName}" using:
"${promptText}"

Rules:
- MUST be written entirely in the past tense
- Informative and reflective
- Assume the event has already happened
- Do not invent outcomes or details
- Adapt the wording; do not repeat the description verbatim
`;

      case 'summary':
        return `${baseInstruction}
Write a concise 2–3 sentence summary in past tense for the event "${eventName}" based on:
"${promptText}"

Rules:
- Factual
- No added details
- Human, natural wording
`;

      case 'governor_summary':
        return `${baseInstruction}
Write a 2–3 sentence governor report summary in past tense for the event "${eventName}" based on:
"${promptText}"

Rules:
- Focus on outcomes and value
- No invented achievements
- Formal, factual tone
`;

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
        return 300;
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
