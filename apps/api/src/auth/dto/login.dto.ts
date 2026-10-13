import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  //Transform cua 1 minh Email
  @ApiProperty({
    example: 'user@example.com',
    format: 'email',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email: string;

  @ApiProperty({
    maxLength: 128,
    writeOnly: true,
  })
  @IsNotEmpty()
  @MaxLength(128)
  @IsString()
  password: string;
}
