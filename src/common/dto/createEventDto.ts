// src/modules/event/dto/create-event.dto.ts

import {
  IsInt,
  IsString,
  IsOptional,
  IsDateString,
  IsNotEmpty,
  IsEmail,
} from 'class-validator';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  @IsNotEmpty()
  time_span: number;

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
  date_time: string;

  @IsString()
  @IsOptional()
  description?: string;
}
