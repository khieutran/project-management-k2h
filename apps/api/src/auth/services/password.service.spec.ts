import * as argon2 from 'argon2';

import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const passwordService = new PasswordService();

  it('hashes a password using the configured Argon2id parameters', async () => {
    const password = 'correct-horse-battery-staple';

    const passwordHash = await passwordService.hash(password);

    expect(passwordHash).not.toBe(password);
    expect(passwordHash).toMatch(/^\$argon2id\$v=19\$/);
    expect(
      argon2.needsRehash(passwordHash, {
        memoryCost: 65_536,
        timeCost: 3,
        parallelism: 4,
      }),
    ).toBe(false);

    await expect(argon2.verify(passwordHash, password)).resolves.toBe(true);
  });

  it('user a different random salt for each password hash', async () => {
    const password = 'same-password-each-time';

    const firstHash = await passwordService.hash(password);
    const secondHash = await passwordService.hash(password);

    expect(firstHash).not.toBe(secondHash);

    await expect(passwordService.verify(firstHash, password)).resolves.toBe(
      true,
    );

    await expect(passwordService.verify(secondHash, password)).resolves.toBe(
      true,
    );
  });

  describe('verify', () => {
    const password = 'correct-horse-battery-staple';
    let passwordHash: string;

    beforeAll(async () => {
      passwordHash = await passwordService.hash(password);
    });

    it('returns true when the candidate password is correct', async () => {
      await expect(
        passwordService.verify(passwordHash, password),
      ).resolves.toBe(true);
    });

    it('returns false when the candidate password is incorrect', async () => {
      await expect(
        passwordService.verify(passwordHash, 'incorrect-password'),
      ).resolves.toBe(false);
    });

    it('preserves leading and trailing password whitespace', async () => {
      const passwordWithWhitespace = '  password-with-significant-spaces  ';

      const passwordHash = await passwordService.hash(passwordWithWhitespace);

      await expect(
        passwordService.verify(passwordHash, passwordWithWhitespace),
      ).resolves.toBe(true);

      await expect(
        passwordService.verify(passwordHash, passwordWithWhitespace.trim()),
      ).resolves.toBe(false);
    });

    it('returns false for a malformed password hash', async () => {
      await expect(
        passwordService.verify('not-a-valid-argon2-hash', 'candidate-password'),
      ).resolves.toBe(false);
    });
  });
});
