import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function trimNullableString(value: unknown): unknown {
  const normalized = trimString(value);

  return normalized === '' ? null : normalized;
}

export class UpdateProjectDto {
  @ApiPropertyOptional({
    example: 'Project Management K2H',
    minLength: 3,
    maxLength: 100,
  })
  @Transform(({ value }) => trimString(value))
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name?: string;

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
