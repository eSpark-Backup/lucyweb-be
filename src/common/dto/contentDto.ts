// src/common/dto/contentDto.ts

import { IsNotEmpty, IsOptional, IsString, IsArray } from 'class-validator';

export class CreateContentDto {
  @IsString()
  @IsNotEmpty()
  content_type: string;

  @IsString()
  @IsNotEmpty()
  text_content: string;

  @IsOptional()
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
  @IsString()
  content_type?: string;

  @IsOptional()
  @IsString()
  text_content?: string;

  @IsOptional()
  attachment?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  content_recipients?: string[];

  @IsOptional()
  @IsString()
  post_method?: string;
}
