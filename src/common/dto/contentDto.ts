import { IsNotEmpty, IsOptional, IsString, IsArray } from 'class-validator';

export class CreateContentDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  content_types: string[];

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  text_content: string[];

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
  content_types?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  text_content: string[];

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
