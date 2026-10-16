import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { ProjectMemberRole } from '../enums/project-member-role.enum';

export class ChangeProjectMemberRoleDto {
  @ApiProperty({
    enum: ProjectMemberRole,
    enumName: 'ProjectMemberRole',
    example: ProjectMemberRole.Manager,
  })
  @IsEnum(ProjectMemberRole)
  role: ProjectMemberRole;
}
