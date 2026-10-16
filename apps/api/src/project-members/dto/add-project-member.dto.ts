import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum } from 'class-validator';

import { ProjectMemberRole } from '../enums/project-member-role.enum';

export class AddProjectMemberDto {
  @ApiProperty({
    example: 'member@example.com',
    format: 'email',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email: string;

  @ApiProperty({
    enum: ProjectMemberRole,
    enumName: 'ProjectMemberRole',
    example: ProjectMemberRole.Member,
  })
  @IsEnum(ProjectMemberRole)
  role: ProjectMemberRole;
}
