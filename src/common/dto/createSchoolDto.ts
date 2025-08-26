/* eslint-disable prettier/prettier */
import { IsNotEmpty, IsString, IsInt } from 'class-validator';

export class CreateSchoolDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsInt()
  @IsNotEmpty()
  organization_id: number;
}
