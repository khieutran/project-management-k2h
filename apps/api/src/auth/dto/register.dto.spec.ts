import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';

import { RegisterDto } from './register.dto';

async function validateRegisterInput(input: Record<string, unknown>): Promise<{
  dto: RegisterDto;
  errors: ValidationError[];
}> {
  const dto = plainToInstance(RegisterDto, input);
  const errors = await validate(dto);

  return {
    dto,
    errors,
  };
}

describe('RegisterDto', () => {
  const validInput = {
    email: 'user@example.com',
    password: 'password-123',
    displayName: 'Nguyen Van A',
  };

  it('normalizes a valid email and display name without trimming password', async () => {
    const password = '  password-123  ';

    const { dto, errors } = await validateRegisterInput({
      email: '  USER@Example.COM  ',
      password,
      displayName: '  Nguyen Van A  ',
    });

    expect(errors).toHaveLength(0);
    expect(dto.email).toBe('user@example.com');
    expect(dto.displayName).toBe('Nguyen Van A');
    expect(dto.password).toBe(password);
  });

  it('rejects an invalid email', async () => {
    const { errors } = await validateRegisterInput({
      ...validInput,
      email: 'not-an-email',
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'email',
        }),
      ]),
    );
  });

  it.each([
    {
      description: 'shorter than 10 characters',
      password: 'short',
    },
    {
      description: 'longer than 128 characters',
      password: 'a'.repeat(129),
    },
  ])('rejects a password $description', async ({ password }) => {
    const { errors } = await validateRegisterInput({
      ...validInput,
      password,
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'password',
        }),
      ]),
    );
  });

  it('rejects a blank display name', async () => {
    const { errors } = await validateRegisterInput({
      ...validInput,
      displayName: '   ',
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'displayName',
        }),
      ]),
    );
  });
});
