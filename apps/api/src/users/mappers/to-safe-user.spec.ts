import { User } from '../entities/user.entity';
import { UserRole } from '../enums/user-role.enum';
import { toSafeUser } from './to-safe-user';

describe('toSafeUser', () => {
  it('maps a User entity to an explicit public representation', () => {
    const user = Object.assign(new User(), {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'user@example.com',
      passwordHash: 'argon2-secret-password-hash',
      displayName: 'Nguyen Van A',
      role: UserRole.User,
      createdAt: new Date('2026-10-05T00:00:00.000Z'),
      updatedAt: new Date('2026-10-05T00:00:00.000Z'),
    });

    const result = toSafeUser(user);

    expect(result).toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'user@example.com',
      displayName: 'Nguyen Van A',
      role: UserRole.User,
    });

    expect(result).not.toBe(user);
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('createdAt');
    expect(result).not.toHaveProperty('updatedAt');
  });
});
