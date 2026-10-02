import { getMetadataArgsStorage } from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { RefreshSession } from './refresh-session.entity';

describe('RefreshSession entity', () => {
  it('maps the RefreshSession class to the refresh_sessions table', () => {
    const tableMetadata = getMetadataArgsStorage().tables.find(
      ({ target }) => target === RefreshSession,
    );

    expect(tableMetadata).toBeDefined();
    expect(tableMetadata?.name).toBe('refresh_sessions');
  });

  it('defines id as a generated UUID primary column', () => {
    const metadata = getMetadataArgsStorage();
    const idColumn = metadata
      .filterColumns(RefreshSession)
      .find(({ propertyName }) => propertyName === 'id');
    const idGeneration = metadata.findGenerated(RefreshSession, 'id');

    expect(idColumn).toBeDefined();
    expect(idColumn?.options).toMatchObject({
      type: 'uuid',
      primary: true,
    });
    expect(idGeneration?.strategy).toBe('uuid');
  });

  it('maps familyId to an indexed family_id UUID column', () => {
    const metadata = getMetadataArgsStorage();

    const familyIdColumn = metadata
      .filterColumns(RefreshSession)
      .find(({ propertyName }) => propertyName === 'familyId');

    const familyIdIndex = metadata
      .filterIndices(RefreshSession)
      .find(({ name }) => {
        return name === 'IDX_refresh_sessions_family_id';
      });

    expect(familyIdColumn).toBeDefined();
    expect(familyIdColumn?.options).toMatchObject({
      name: 'family_id',
      type: 'uuid',
    });

    expect(familyIdIndex).toBeDefined();
    expect(familyIdIndex?.columns).toEqual(['familyId']);
    expect(familyIdIndex?.unique).toBe(false);
  });

  it('maps tokenDigest to a unique token_digest varchar column', () => {
    const tokenDigestColumn = getMetadataArgsStorage()
      .filterColumns(RefreshSession)
      .find(({ propertyName }) => propertyName === 'tokenDigest');

    expect(tokenDigestColumn).toBeDefined();
    expect(tokenDigestColumn?.options).toMatchObject({
      name: 'token_digest',
      type: 'varchar',
      unique: true,
    });
  });

  it('maps expiresAt to a required expires_at timestamptz column', () => {
    const expiresAtColumn = getMetadataArgsStorage()
      .filterColumns(RefreshSession)
      .find(({ propertyName }) => propertyName === 'expiresAt');

    expect(expiresAtColumn).toBeDefined();
    expect(expiresAtColumn?.options).toMatchObject({
      name: 'expires_at',
      type: 'timestamptz',
    });
    expect(expiresAtColumn?.options.nullable).not.toBe(true);
  });

  it('defines nullable revoke and replacement columns', () => {
    const columns = getMetadataArgsStorage().filterColumns(RefreshSession);

    const revokedAtColumn = columns.find(
      ({ propertyName }) => propertyName === 'revokedAt',
    );

    const replacedBySessionIdColumn = columns.find(({ propertyName }) => {
      return propertyName === 'replacedBySessionId';
    });

    expect(revokedAtColumn).toMatchObject({
      options: {
        name: 'revoked_at',
        type: 'timestamptz',
        nullable: true,
      },
    });

    expect(replacedBySessionIdColumn).toMatchObject({
      options: {
        name: 'replaced_by_session_id',
        type: 'uuid',
        nullable: true,
      },
    });
  });

  it('maps automatic creation and update timestamps', () => {
    const columns = getMetadataArgsStorage().filterColumns(RefreshSession);

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

  it('belongs to a User through a cascading user_id foreign key', () => {
    const metadata = getMetadataArgsStorage();

    const userIdColumn = metadata
      .filterColumns(RefreshSession)
      .find(({ propertyName }) => propertyName === 'userId');

    const userRelation = metadata
      .filterRelations(RefreshSession)
      .find(({ propertyName }) => propertyName === 'user');

    const userJoinColumn = metadata
      .filterJoinColumns(RefreshSession, 'user')
      .find(({ name }) => name === 'user_id');

    expect(userIdColumn).toBeDefined();
    expect(userIdColumn?.options).toMatchObject({
      name: 'user_id',
      type: 'uuid',
    });
    expect(userIdColumn?.options.nullable).not.toBe(true);

    expect(userRelation).toBeDefined();
    expect(userRelation?.relationType).toBe('many-to-one');
    expect(userRelation?.options).toMatchObject({
      nullable: false,
      onDelete: 'CASCADE',
    });

    const relationTarget = userRelation?.type as () => unknown;

    expect(relationTarget()).toBe(User);

    expect(userJoinColumn).toMatchObject({
      name: 'user_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'FK_refresh_sessions_user_id',
    });
  });
});
