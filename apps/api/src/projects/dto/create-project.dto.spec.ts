import { BadRequestException, type ArgumentMetadata } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';

import { createApplicationValidationPipe } from '../../common/validation/create-application-validation-pipe';
import { CreateProjectDto } from './create-project.dto';

async function validateInput(input: Record<string, unknown>): Promise<{
  dto: CreateProjectDto;
  errors: ValidationError[];
}> {
  const dto = plainToInstance(CreateProjectDto, input);

  return { dto, errors: await validate(dto) };
}

describe('CreateProjectDto', () => {
  const validInput = {
    key: 'K2H',
    name: 'Project Management K2H',
  };

  it('normalizes key, name, description, and date-only values', async () => {
    const { dto, errors } = await validateInput({
      key: '  k2h  ',
      name: '  Project Management K2H  ',
      description: '  Learn by building  ',
      startDate: '  2026-10-15  ',
      endDate: '  2027-03-31  ',
    });

    expect(errors).toHaveLength(0);
    expect(dto).toMatchObject({
      key: 'K2H',
      name: 'Project Management K2H',
      description: 'Learn by building',
      startDate: '2026-10-15',
      endDate: '2027-03-31',
    });
  });

  it('normalizes a blank optional description to null', async () => {
    const { dto, errors } = await validateInput({
      ...validInput,
      description: '   ',
    });

    expect(errors).toHaveLength(0);
    expect(dto.description).toBeNull();
  });

  it.each(['A', 'PROJECT-1', 'PROJECT_KEY', 'ABCDEFGHIJK'])(
    'rejects invalid project key %s',
    async (key) => {
      const { errors } = await validateInput({ ...validInput, key });

      expect(errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ property: 'key' })]),
      );
    },
  );

  it.each(['2026-02-30', '2026-10-15T00:00:00.000Z', '15-10-2026'])(
    'rejects invalid date-only value %s',
    async (startDate) => {
      const { errors } = await validateInput({ ...validInput, startDate });

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ property: 'startDate' }),
        ]),
      );
    },
  );

  it.each(['ownerId', 'status', 'archivedAt', 'deletedAt', 'createdAt'])(
    'rejects forbidden field %s through the application validation pipe',
    async (field) => {
      const pipe = createApplicationValidationPipe();
      const metadata: ArgumentMetadata = {
        type: 'body',
        metatype: CreateProjectDto,
      };

      await expect(
        pipe.transform({ ...validInput, [field]: 'forbidden' }, metadata),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );
});
