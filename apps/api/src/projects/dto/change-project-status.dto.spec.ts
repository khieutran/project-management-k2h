import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ProjectStatus } from '../enums/project-status.enum';
import { ChangeProjectStatusDto } from './change-project-status.dto';

describe('ChangeProjectStatusDto', () => {
  it.each(Object.values(ProjectStatus))(
    'accepts project status %s',
    async (status) => {
      const dto = plainToInstance(ChangeProjectStatusDto, { status });

      await expect(validate(dto)).resolves.toHaveLength(0);
    },
  );

  it('rejects a value outside the project lifecycle', async () => {
    const dto = plainToInstance(ChangeProjectStatusDto, {
      status: 'ARCHIVED',
    });

    const errors = await validate(dto);

    expect(errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'status' })]),
    );
  });
});
