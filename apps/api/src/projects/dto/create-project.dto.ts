import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const PROJECT_KEY_PATTERN = /^[A-Z0-9]{2,10}$/;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function trimNullableString(value: unknown): unknown {
  const normalized = trimString(value);

  return normalized === '' ? null : normalized;
}

export class CreateProjectDto {
  @ApiProperty({ example: 'K2H', minLength: 2, maxLength: 10 })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(PROJECT_KEY_PATTERN)
  key: string;

  @ApiProperty({
    example: 'Project Management K2H',
    minLength: 3,
    maxLength: 100,
  })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    example: 'Hệ thống quản lý dự án',
    maxLength: 2000,
    nullable: true,
  })
  @Transform(({ value }) => trimNullableString(value))
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ example: '2026-10-15', nullable: true })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  @Matches(DATE_ONLY_PATTERN)
  @IsISO8601({ strict: true, strictSeparator: true })
  startDate?: string | null;

  @ApiPropertyOptional({ example: '2027-03-31', nullable: true })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  @Matches(DATE_ONLY_PATTERN)
  @IsISO8601({ strict: true, strictSeparator: true })
  endDate?: string | null;
}
