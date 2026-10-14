import { getMetadataArgsStorage } from 'typeorm';
import { User } from './user.entity';
import { UserRole } from '../enums/user-role.enum';

describe('User entity', () => {
  it('maps the User class to the users table', () => {
    const tableMetadata = getMetadataArgsStorage().tables.find(
      ({ target }) => target === User,
    );

    expect(tableMetadata).toBeDefined();
    expect(tableMetadata?.name).toBe('users');
  });

  it('defines id as a generated UUID primary column', () => {
    const metadata = getMetadataArgsStorage();
    const idColumn = metadata
      .filterColumns(User)
      .find(({ propertyName }) => propertyName === 'id');
    const idGeneration = metadata.findGenerated(User, 'id');

    expect(idColumn).toBeDefined();
    expect(idColumn?.options).toMatchObject({
      type: 'uuid',
      primary: true,
    });
    expect(idGeneration?.strategy).toBe('uuid');
  });

  it('defines email as a unique varchar column', () => {
    const emailColumn = getMetadataArgsStorage()
      .filterColumns(User)
      .find(({ propertyName }) => propertyName === 'email');

    expect(emailColumn).toBeDefined();
    expect(emailColumn?.options).toMatchObject({
      type: 'varchar',
      unique: true,
    });
  });

  it('maps passwordHash to the password_hash varchar column', () => {
    const passwordHashColumn = getMetadataArgsStorage()
      .filterColumns(User)
      .find(({ propertyName }) => propertyName === 'passwordHash');

    expect(passwordHashColumn).toBeDefined();
    expect(passwordHashColumn?.options).toMatchObject({
      name: 'password_hash',
      type: 'varchar',
    });
  });

  it('maps displayName to the display_name varchar column', () => {
    const displayNameColumn = getMetadataArgsStorage()
      .filterColumns(User)
      .find(({ propertyName }) => propertyName === 'displayName');

    expect(displayNameColumn).toBeDefined();
    expect(displayNameColumn?.options).toMatchObject({
      name: 'display_name',
      type: 'varchar',
    });
  });

  it('defines role as a PostgreSQL enum defaulting to USER', () => {
    const roleColumn = getMetadataArgsStorage()
      .filterColumns(User)
      .find(({ propertyName }) => propertyName === 'role');

    expect(roleColumn).toBeDefined();
    expect(roleColumn?.options).toMatchObject({
      type: 'enum',
      enum: UserRole,
      enumName: 'user_role_enum',
      default: UserRole.User,
    });
  });

  it('maps automatic creation and update timestamps', () => {
    const columns = getMetadataArgsStorage().filterColumns(User);

    const createdAtColumn = columns.find(
      ({ propertyName }) => propertyName === 'createdAt',
    );

    const updatedAtColumn = columns.find(
      ({ propertyName }) => propertyName === 'updatedAt',
    );

    expect(createdAtColumn).toMatchObject({
      mode: 'createDate',
      options: {
        name: 'created_at',
        type: 'timestamptz',
      },
    });

    expect(updatedAtColumn).toMatchObject({
      mode: 'updateDate',
      options: {
        name: 'updated_at',
        type: 'timestamptz',
      },
    });
  });
});
