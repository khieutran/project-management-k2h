import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { ProjectStatus } from '../enums/project-status.enum';

export class ChangeProjectStatusDto {
  @ApiProperty({ enum: ProjectStatus, enumName: 'ProjectStatus' })
  @IsEnum(ProjectStatus)
  status: ProjectStatus;
}
