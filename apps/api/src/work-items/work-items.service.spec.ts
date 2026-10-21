import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { ProjectAccessRole } from '../projects/enums/project-access-role.enum';
import { UserRole } from '../users/enums/user-role.enum';
import { UpdateWorkItemDto } from './work-item.dto';
import { WorkItemsService } from './work-items.service';

describe('WorkItemsService', () => {
  const actor = { userId: 'user-1', sessionId: 'session-1', role: UserRole.User };
  const project = { id: 'project-1', archivedAt: null, deletedAt: null };
  const item = {
    id: 'item-1', projectId: 'project-1', type: 'TASK', title: 'Build API',
    description: null, status: 'TODO', priority: 'MEDIUM', dueDate: null,
    assigneeId: null, labels: [], createdAt: new Date(), updatedAt: new Date(),
  };
  let repository: {
    find: jest.Mock; findOne: jest.Mock; create: jest.Mock; save: jest.Mock; remove: jest.Mock;
  };
  let access: { findReadableProjectOrThrow: jest.Mock };
  let service: WorkItemsService;

  beforeEach(() => {
    repository = {
      find: jest.fn().mockResolvedValue([item]),
      findOne: jest.fn().mockResolvedValue(item),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ ...value, id: 'item-1' })),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    access = { findReadableProjectOrThrow: jest.fn().mockResolvedValue({ project, accessRole: ProjectAccessRole.Owner }) };
    service = new WorkItemsService(repository as never, access as never);
  });

  it('lists items only after checking project read access', async () => {
    await expect(service.list(actor, project.id)).resolves.toHaveLength(1);
    expect(access.findReadableProjectOrThrow).toHaveBeenCalledWith(actor, project.id, { includeDeleted: false });
    expect(repository.find).toHaveBeenCalledWith(expect.objectContaining({ where: { projectId: project.id } }));
  });

  it('does not leak items when project access fails', async () => {
    access.findReadableProjectOrThrow.mockRejectedValue(new NotFoundException());
    await expect(service.list(actor, project.id)).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.find).not.toHaveBeenCalled();
  });

  it('reads a deleted project’s parcels only in the explicit ADMIN view', async () => {
    const admin = { ...actor, role: UserRole.Admin };
    access.findReadableProjectOrThrow.mockImplementation((_user, _projectId, options) => {
      if (!options?.includeDeleted) throw new NotFoundException();
      return { project: { ...project, deletedAt: new Date() }, accessRole: ProjectAccessRole.AdminViewer };
    });

    await expect(Reflect.apply(service.list, service, [admin, project.id, true])).resolves.toHaveLength(1);
    await expect(Reflect.apply(service.detail, service, [admin, project.id, item.id, true])).resolves.toMatchObject({ id: item.id });
    expect(access.findReadableProjectOrThrow).toHaveBeenCalledWith(admin, project.id, { includeDeleted: true });
  });

  it('rejects an ADMIN viewer creating a parcel', async () => {
    access.findReadableProjectOrThrow.mockResolvedValue({ project, accessRole: ProjectAccessRole.AdminViewer });
    await expect(service.create(actor, project.id, { type: 'TASK', title: 'Build API' } as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('rejects mutations for archived projects', async () => {
    access.findReadableProjectOrThrow.mockResolvedValue({ project: { ...project, archivedAt: new Date() }, accessRole: ProjectAccessRole.Owner });
    await expect(service.create(actor, project.id, { type: 'TASK', title: 'Build API' } as never)).rejects.toBeInstanceOf(ConflictException);
  });

  it('hides an item belonging to another project', async () => {
    repository.findOne.mockResolvedValue({ ...item, projectId: 'project-2' });
    await expect(service.detail(actor, project.id, item.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('preserves omitted fields when updating one work item property', async () => {
    repository.findOne.mockResolvedValue({ ...item });
    const input = plainToInstance(UpdateWorkItemDto, { status: 'DONE' });

    await service.update(actor, project.id, item.id, input);

    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Build API',
      description: null,
      priority: 'MEDIUM',
      status: 'DONE',
      labels: [],
    }));
  });
});
