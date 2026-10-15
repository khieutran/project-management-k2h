import { getMetadataArgsStorage } from 'typeorm';

import { Project } from '../../projects/entities/project.entity';
import { User } from '../../users/entities/user.entity';
import { ProjectMemberRole } from '../enums/project-member-role.enum';
import { ProjectMember } from './project-member.entity';

describe('ProjectMember entity', () => {
  it('maps the entity to the project_members table', () => {
    const table = getMetadataArgsStorage().tables.find(
      ({ target }) => target === ProjectMember,
    );

    expect(table?.name).toBe('project_members');
  });

  it('defines id as a generated UUID primary column', () => {
    const metadata = getMetadataArgsStorage();
    const idColumn = metadata
      .filterColumns(ProjectMember)
      .find(({ propertyName }) => propertyName === 'id');
    const idGeneration = metadata.findGenerated(ProjectMember, 'id');

    expect(idColumn?.options).toMatchObject({
      type: 'uuid',
      primary: true,
    });
    expect(idGeneration?.strategy).toBe('uuid');
  });

  it('belongs to a Project through a cascading project_id foreign key', () => {
    const metadata = getMetadataArgsStorage();
    const projectIdColumn = metadata
      .filterColumns(ProjectMember)
      .find(({ propertyName }) => propertyName === 'projectId');
    const projectRelation = metadata
      .filterRelations(ProjectMember)
      .find(({ propertyName }) => propertyName === 'project');
    const projectJoinColumn = metadata
      .filterJoinColumns(ProjectMember, 'project')
      .find(({ name }) => name === 'project_id');

    expect(projectIdColumn?.options).toMatchObject({
      name: 'project_id',
      type: 'uuid',
    });
    expect(projectIdColumn?.options.nullable).not.toBe(true);
    expect(projectRelation?.relationType).toBe('many-to-one');
    expect(projectRelation?.options).toMatchObject({
      nullable: false,
      onDelete: 'CASCADE',
    });

    const relationTarget = projectRelation?.type as () => unknown;
    expect(relationTarget()).toBe(Project);
    expect(projectJoinColumn).toMatchObject({
      name: 'project_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'FK_project_members_project_id',
    });
  });

  it('belongs to a User through a cascading user_id foreign key', () => {
    const metadata = getMetadataArgsStorage();
    const userIdColumn = metadata
      .filterColumns(ProjectMember)
      .find(({ propertyName }) => propertyName === 'userId');
    const userRelation = metadata
      .filterRelations(ProjectMember)
      .find(({ propertyName }) => propertyName === 'user');
    const userJoinColumn = metadata
      .filterJoinColumns(ProjectMember, 'user')
      .find(({ name }) => name === 'user_id');

    expect(userIdColumn?.options).toMatchObject({
      name: 'user_id',
      type: 'uuid',
    });
    expect(userIdColumn?.options.nullable).not.toBe(true);
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
      foreignKeyConstraintName: 'FK_project_members_user_id',
    });
  });

  it('defines role as a required PostgreSQL membership enum', () => {
    const roleColumn = getMetadataArgsStorage()
      .filterColumns(ProjectMember)
      .find(({ propertyName }) => propertyName === 'role');

    expect(roleColumn?.options).toMatchObject({
      type: 'enum',
      enum: ProjectMemberRole,
      enumName: 'project_member_role_enum',
    });
    expect(roleColumn?.options.nullable).not.toBe(true);
  });

  it('prevents duplicate users and indexes both lookup directions', () => {
    const metadata = getMetadataArgsStorage();
    const unique = metadata
      .filterUniques(ProjectMember)
      .find(({ name }) => name === 'UQ_project_members_project_user');
    const indexes = metadata.filterIndices(ProjectMember);

    expect(unique?.columns).toEqual(['projectId', 'userId']);
    expect(
      indexes.find(({ name }) => name === 'IDX_project_members_project_id')
        ?.columns,
    ).toEqual(['projectId']);
    expect(
      indexes.find(({ name }) => name === 'IDX_project_members_user_id')
        ?.columns,
    ).toEqual(['userId']);
  });

  it('maps joined and automatic timestamps', () => {
    const columns = getMetadataArgsStorage().filterColumns(ProjectMember);
    const joinedAtColumn = columns.find(
      ({ propertyName }) => propertyName === 'joinedAt',
    );
    const createdAtColumn = columns.find(
      ({ propertyName }) => propertyName === 'createdAt',
    );
    const updatedAtColumn = columns.find(
      ({ propertyName }) => propertyName === 'updatedAt',
    );

    expect(joinedAtColumn?.options).toMatchObject({
      name: 'joined_at',
      type: 'timestamptz',
    });
    expect(joinedAtColumn?.options.nullable).not.toBe(true);
    expect(createdAtColumn).toMatchObject({
      mode: 'createDate',
      options: { name: 'created_at', type: 'timestamptz' },
    });
    expect(updatedAtColumn).toMatchObject({
      mode: 'updateDate',
      options: { name: 'updated_at', type: 'timestamptz' },
    });
  });
});
