import { BadRequestException, type ArgumentMetadata } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { createApplicationValidationPipe } from '../../common/validation/create-application-validation-pipe';
import { ProjectMemberRole } from '../enums/project-member-role.enum';
import { AddProjectMemberDto } from './add-project-member.dto';

describe('AddProjectMemberDto', () => {
  it('normalizes an exact email and accepts a supported role', async () => {
    const dto = plainToInstance(AddProjectMemberDto, {
      email: '  MEMBER@Example.COM  ',
      role: ProjectMemberRole.Member,
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto).toEqual({
      email: 'member@example.com',
      role: ProjectMemberRole.Member,
    });
  });

  it('rejects an invalid email', async () => {
    const dto = plainToInstance(AddProjectMemberDto, {
      email: 'not-an-email',
      role: ProjectMemberRole.Member,
    });

    expect(await validate(dto)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'email' }),
      ]),
    );
  });

  it.each(['OWNER', 'ADMIN_VIEWER', 'UNKNOWN'])('rejects role %s', async (role) => {
    const dto = plainToInstance(AddProjectMemberDto, {
      email: 'member@example.com',
      role,
    });

    expect(await validate(dto)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'role' }),
      ]),
    );
  });

  it('rejects fields outside the add-member contract', async () => {
    const pipe = createApplicationValidationPipe();
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: AddProjectMemberDto,
    };

    await expect(
      pipe.transform(
        {
          email: 'member@example.com',
          role: ProjectMemberRole.Manager,
          userId: '11111111-1111-4111-8111-111111111111',
        },
        metadata,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
