import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { LoginDto } from './login.dto';

//describe: la mo ta cac test trong LoginDto
describe('LoginDto', () => {
  it('normalizes email without trimming password', () => {
    // Arrange
    const password = '  password-123  ';
    const input = {
      email: '  USER@Example.COM  ',
      password,
    };

    // Act
    const dto = plainToInstance(LoginDto, input);

    // Assert
    expect(dto.email).toBe('user@example.com');
    expect(dto.password).toBe(password);
  });

  it('rejects an invalid email', async () => {
    //Arrange:
    const input = {
      email: 'not-an-email',
      password: 'password-123',
    };

    //Act
    const dto = plainToInstance(LoginDto, input);
    const errors = await validate(dto);

    //Assert
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'email',
        }),
      ]),
    );
  });

  it('rejects an empty password', async () => {
    //Arrange
    const input = {
      email: 'user@example.com',
      password: '',
    };

    //Act
    const dto = plainToInstance(LoginDto, input);
    const errors = await validate(dto);

    //assert
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'password',
        }),
      ]),
    );
  });

  it('accepts a 128-character password', async () => {
    const input = {
      email: 'user@example.com',
      password: 'a'.repeat(128),
    };

    const dto = plainToInstance(LoginDto, input);
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects a 129-character password', async () => {
    const input = {
      email: 'user@example.com',
      password: 'a'.repeat(129),
    };

    const dto = plainToInstance(LoginDto, input);
    const errors = await validate(dto);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'password',
        }),
      ]),
    );
  });

  it('rejects a not-string password', async () => {
    const input = {
      email: 'user@example.com',
      password: 1234567890,
    };

    const dto = plainToInstance(LoginDto, input);
    const errors = await validate(dto);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'password',
          constraints: expect.objectContaining({
            isString: expect.any(String),
          }),
        }),
      ]),
    );
  });
});
