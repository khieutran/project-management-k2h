import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { ProjectStatus } from '../enums/project-status.enum';

export enum ProjectListView {
  Current = 'current',
  Archived = 'archived',
  Deleted = 'deleted',
}

export enum ProjectListSort {
  UpdatedDesc = 'updated_desc',
  CreatedAsc = 'created_asc',
}

export class ListProjectsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ maxLength: 100 })
  @Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }

    const normalized = value.trim();

    return normalized.length === 0 ? undefined : normalized;
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: ProjectStatus, enumName: 'ProjectStatus' })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({
    enum: ProjectListView,
    enumName: 'ProjectListView',
    default: ProjectListView.Current,
  })
  @IsEnum(ProjectListView)
  view = ProjectListView.Current;

  @ApiPropertyOptional({ enum: ProjectListSort, enumName: 'ProjectListSort', default: ProjectListSort.UpdatedDesc })
  @IsOptional()
  @IsEnum(ProjectListSort)
  sort?: ProjectListSort = ProjectListSort.UpdatedDesc;
}
