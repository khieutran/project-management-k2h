import { BadRequestException, type ArgumentMetadata } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';

import { createApplicationValidationPipe } from '../../common/validation/create-application-validation-pipe';
import { UpdateProjectDto } from './update-project.dto';

async function validateInput(input: Record<string, unknown>): Promise<{
  dto: UpdateProjectDto;
  errors: ValidationError[];
}> {
  const dto = plainToInstance(UpdateProjectDto, input);

  return { dto, errors: await validate(dto) };
}

describe('UpdateProjectDto', () => {
  it('normalizes supplied partial fields and permits null clearing', async () => {
    const { dto, errors } = await validateInput({
      name: '  Renamed project  ',
      description: '   ',
      startDate: null,
      endDate: '  2027-03-31  ',
    });

    expect(errors).toHaveLength(0);
    expect(dto).toMatchObject({
      name: 'Renamed project',
      description: null,
      startDate: null,
      endDate: '2027-03-31',
    });
  });

  it.each([null, '  ', 'ab'])(
    'rejects invalid project name %p',
    async (name) => {
      const { errors } = await validateInput({ name });

      expect(errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ property: 'name' })]),
      );
    },
  );

  it('rejects an invalid date-only value', async () => {
    const { errors } = await validateInput({ endDate: '2026-02-30' });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'endDate' }),
      ]),
    );
  });

  it.each(['key', 'ownerId', 'status', 'archivedAt', 'deletedAt'])(
    'rejects forbidden field %s through the application validation pipe',
    async (field) => {
      const pipe = createApplicationValidationPipe();
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: UpdateProjectDto,
      };

      await expect(
        pipe.transform(
          { name: 'Renamed project', [field]: 'forbidden' },
          metadata,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );
});
