import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class CreateSchoolDto {
  @IsEmail()
  email: string;

  @MinLength(6)
  password: string;

  @IsNotEmpty()
  first_name: string;

  @IsNotEmpty()
  last_name: string;

  phone?: string;
}
