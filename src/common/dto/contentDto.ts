import { IsNotEmpty, IsOptional, IsString, IsArray } from 'class-validator';

export class CreateContentDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  content_types: string[]; // ✅ supports one or many content types

  @IsString()
  @IsNotEmpty()
  event_name: string;

  @IsString()
  @IsNotEmpty()
  text_content: string;

  @IsOptional()
  @IsString()
  attachment?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  content_recipients?: string[];

  @IsOptional()
  @IsString()
  post_method?: string;
}

export class UpdateContentDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  content_types?: string[]; // ✅ can update to one or many

  @IsOptional()
  @IsString()
  event_name?: string;

  @IsOptional()
  @IsString()
  text_content?: string;

  @IsOptional()
  @IsString()
  attachment?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  content_recipients?: string[];

  @IsOptional()
  @IsString()
  post_method?: string;
}
