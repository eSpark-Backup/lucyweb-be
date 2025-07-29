import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateContentDto {
  @IsNotEmpty()
  content_type: string;

  @IsNotEmpty()
  text_content: string;

  @IsOptional()
  @IsString()
  attachment?: string;

  @IsOptional()
  @IsString()
  content_recipients?: string[];

  @IsOptional()
  @IsString()
  post_method?: string;
}

export class UpdateContentDto {
  @IsOptional()
  @IsNotEmpty()
  content_type?: string;

  @IsOptional()
  @IsNotEmpty()
  text_content?: string;

  @IsOptional()
  @IsString()
  attachment?: string;

  @IsOptional()
  @IsString()
  content_recipients?: string[];

  @IsOptional()
  @IsString()
  post_method?: string;
}
