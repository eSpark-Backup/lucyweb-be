/* eslint-disable prettier/prettier */
import {
  IsNotEmpty,
  IsString,
  IsInt,
  IsEmail,
  IsOptional,
} from 'class-validator';

export class CreateSchoolDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  image?: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsInt()
  @IsNotEmpty()
  organization_id: number;
}
