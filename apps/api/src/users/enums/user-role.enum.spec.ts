import { UserRole } from './user-role.enum';

describe('UserRole', () => {
  it('defines the supported global user roles', () => {
    expect(UserRole).toEqual({
      User: 'USER',
      Admin: 'ADMIN',
    });
  });
});
