import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, MaxLength, IsString } from 'class-validator';

export class LoginDto {
  //Transform cua 1 minh Email
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MaxLength(128)
  @IsString()
  password: string;
}
