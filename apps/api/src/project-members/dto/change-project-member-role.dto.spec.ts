import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ProjectMemberRole } from '../enums/project-member-role.enum';
import { ChangeProjectMemberRoleDto } from './change-project-member-role.dto';

describe('ChangeProjectMemberRoleDto', () => {
  it.each([ProjectMemberRole.Manager, ProjectMemberRole.Member])(
    'accepts supported role %s',
    async (role) => {
      const dto = plainToInstance(ChangeProjectMemberRoleDto, { role });

      expect(await validate(dto)).toHaveLength(0);
      expect(dto.role).toBe(role);
    },
  );

  it.each([undefined, 'OWNER', 'ADMIN_VIEWER', 'UNKNOWN'])(
    'rejects unsupported role %s',
    async (role) => {
      const dto = plainToInstance(ChangeProjectMemberRoleDto, { role });

      expect(await validate(dto)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ property: 'role' }),
        ]),
      );
    },
  );
});
