import { getMetadataArgsStorage } from 'typeorm';

import {
  ProjectMember,
} from '../../project-members/entities/project-member.entity';
import { User } from '../../users/entities/user.entity';
import { ProjectStatus } from '../enums/project-status.enum';
import { Project } from './project.entity';

describe('Project entity', () => {
  it('maps the Project class to the projects table', () => {
    const tableMetadata = getMetadataArgsStorage().tables.find(
      ({ target }) => target === Project,
    );

    expect(tableMetadata).toBeDefined();
    expect(tableMetadata?.name).toBe('projects');
  });

  it('defines id as a generated UUID primary column', () => {
    const metadata = getMetadataArgsStorage();
    const idColumn = metadata
      .filterColumns(Project)
      .find(({ propertyName }) => propertyName === 'id');
    const idGeneration = metadata.findGenerated(Project, 'id');

    expect(idColumn?.options).toMatchObject({
      type: 'uuid',
      primary: true,
    });
    expect(idGeneration?.strategy).toBe('uuid');
  });

  it('defines the immutable project identity columns', () => {
    const columns = getMetadataArgsStorage().filterColumns(Project);
    const keyColumn = columns.find(({ propertyName }) => propertyName === 'key');
    const nameColumn = columns.find(
      ({ propertyName }) => propertyName === 'name',
    );
    const descriptionColumn = columns.find(
      ({ propertyName }) => propertyName === 'description',
    );

    expect(keyColumn?.options).toMatchObject({
      type: 'varchar',
      length: 10,
      unique: true,
    });
    expect(nameColumn?.options).toMatchObject({
      type: 'varchar',
      length: 100,
    });
    expect(descriptionColumn?.options).toMatchObject({
      type: 'varchar',
      length: 2000,
      nullable: true,
    });
  });

  it('belongs to an owner through a restrictive owner_id foreign key', () => {
    const metadata = getMetadataArgsStorage();
    const ownerIdColumn = metadata
      .filterColumns(Project)
      .find(({ propertyName }) => propertyName === 'ownerId');
    const ownerRelation = metadata
      .filterRelations(Project)
      .find(({ propertyName }) => propertyName === 'owner');
    const ownerJoinColumn = metadata
      .filterJoinColumns(Project, 'owner')
      .find(({ name }) => name === 'owner_id');

    expect(ownerIdColumn?.options).toMatchObject({
      name: 'owner_id',
      type: 'uuid',
    });
    expect(ownerIdColumn?.options.nullable).not.toBe(true);

    expect(ownerRelation?.relationType).toBe('many-to-one');
    expect(ownerRelation?.options).toMatchObject({
      nullable: false,
      onDelete: 'RESTRICT',
    });
    expect(ownerRelation?.options.eager).not.toBe(true);

    const relationTarget = ownerRelation?.type as () => unknown;

    expect(relationTarget()).toBe(User);
    expect(ownerJoinColumn).toMatchObject({
      name: 'owner_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'FK_projects_owner_id',
    });
  });

  it('defines status as a PostgreSQL enum defaulting to PLANNING', () => {
    const statusColumn = getMetadataArgsStorage()
      .filterColumns(Project)
      .find(({ propertyName }) => propertyName === 'status');

    expect(statusColumn?.options).toMatchObject({
      type: 'enum',
      enum: ProjectStatus,
      enumName: 'project_status_enum',
      default: ProjectStatus.Planning,
    });
  });

  it('defines nullable project date columns', () => {
    const columns = getMetadataArgsStorage().filterColumns(Project);
    const startDateColumn = columns.find(
      ({ propertyName }) => propertyName === 'startDate',
    );
    const endDateColumn = columns.find(
      ({ propertyName }) => propertyName === 'endDate',
    );

    expect(startDateColumn?.options).toMatchObject({
      name: 'start_date',
      type: 'date',
      nullable: true,
    });
    expect(endDateColumn?.options).toMatchObject({
      name: 'end_date',
      type: 'date',
      nullable: true,
    });
  });

  it('maps archive and soft-delete timestamps separately', () => {
    const columns = getMetadataArgsStorage().filterColumns(Project);
    const archivedAtColumn = columns.find(
      ({ propertyName }) => propertyName === 'archivedAt',
    );
    const deletedAtColumn = columns.find(
      ({ propertyName }) => propertyName === 'deletedAt',
    );

    expect(archivedAtColumn).toMatchObject({
      options: {
        name: 'archived_at',
        type: 'timestamptz',
        nullable: true,
      },
    });
    expect(deletedAtColumn).toMatchObject({
      mode: 'deleteDate',
      options: {
        name: 'deleted_at',
        type: 'timestamptz',
        nullable: true,
      },
    });
  });

  it('maps automatic creation and update timestamps', () => {
    const columns = getMetadataArgsStorage().filterColumns(Project);
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

  it('exposes project memberships without eager loading or cascading writes', () => {
    const membersRelation = getMetadataArgsStorage()
      .filterRelations(Project)
      .find(({ propertyName }) => propertyName === 'members');

    expect(membersRelation?.relationType).toBe('one-to-many');
    expect(membersRelation?.options.eager).not.toBe(true);
    expect(membersRelation?.options.cascade).not.toBe(true);

    const relationTarget = membersRelation?.type as () => unknown;
    expect(relationTarget()).toBe(ProjectMember);
  });
});
