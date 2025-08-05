import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UserRegisterDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @IsString()
  @IsNotEmpty()
  first_name: string;

  @IsString()
  @IsNotEmpty()
  last_name: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @IsNotEmpty()
  role: string;

  @IsOptional()
  @IsString()
  school_name?: string;

  @IsOptional()
  @IsString()
  school_type?: string;

  @IsOptional()
  @IsString()
  school_city?: string;

  @IsOptional()
  @IsString()
  school_region?: string;

  @IsOptional()
  @IsString()
  school_country?: string;

  @IsOptional()
  @IsString()
  school_user_position?: string; 
}
