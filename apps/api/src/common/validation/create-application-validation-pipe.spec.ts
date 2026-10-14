import { BadRequestException, type ArgumentMetadata } from '@nestjs/common';

import { RegisterDto } from '../../auth/dto/register.dto';
import { createApplicationValidationPipe } from './create-application-validation-pipe';

describe('createApplicationValidationPipe', () => {
  const metadata: ArgumentMetadata = {
    type: 'body',
    metatype: RegisterDto,
  };

  const validInput = {
    email: 'user@example.com',
    password: 'password-123',
    displayName: 'Nguyen Van A',
  };

  it('transforms and validates an HTTP body as its DTO type', async () => {
    const pipe = createApplicationValidationPipe();

    const result = (await pipe.transform(
      {
        ...validInput,
        email: '  USER@Example.COM  ',
        displayName: '  Nguyen Van A  ',
      },
      metadata,
    )) as RegisterDto;

    expect(result).toBeInstanceOf(RegisterDto);
    expect(result.email).toBe('user@example.com');
    expect(result.displayName).toBe('Nguyen Van A');
  });

  it('rejects properties outside the DTO contract', async () => {
    const pipe = createApplicationValidationPipe();

    await expect(
      pipe.transform(
        {
          ...validInput,
          role: 'ADMIN',
        },
        metadata,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a body that violates DTO validation', async () => {
    const pipe = createApplicationValidationPipe();

    await expect(
      pipe.transform(
        {
          ...validInput,
          password: 'short',
        },
        metadata,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
