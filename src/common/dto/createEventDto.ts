// src/modules/event/dto/create-event.dto.ts

import {
  IsInt,
  IsString,
  IsOptional,
  IsDateString,
  IsNotEmpty,
  IsEmail,
  IsArray,
} from 'class-validator';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  @IsOptional()
  school_id?: number;

  @IsString()
  @IsEmail()
  @IsOptional()
  school_email?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsDateString()
  @IsNotEmpty()
  start_date: string;

  @IsDateString()
  @IsNotEmpty()
  end_date: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}
