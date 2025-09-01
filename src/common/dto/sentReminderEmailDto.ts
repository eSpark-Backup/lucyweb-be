import { IsNotEmpty, IsOptional, IsString, IsArray } from 'class-validator';

export class SendReminderEmailDto {
  @IsString()
  @IsNotEmpty()
  content_type: string;

  @IsString()
  @IsNotEmpty()
  text_content: string;

  @IsOptional()
  attachment?: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  content_recipients: string[];
}
