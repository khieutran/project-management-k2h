import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import type { AuthenticatedPrincipal } from '../auth/types/authenticated-principal.type';
import { ProjectAccessRole } from '../projects/enums/project-access-role.enum';
import { ProjectAccessService } from '../projects/project-access.service';
import type { CreateWorkItemDto, UpdateWorkItemDto } from './work-item.dto';
import { WorkItem } from './work-item.entity';
import { WorkItemPriority, WorkItemStatus } from './work-item.enums';
import { toWorkItemResponse, type WorkItemResponse } from './work-item.response';

@Injectable()
export class WorkItemsService {
  constructor(
    @InjectRepository(WorkItem) private readonly items: Repository<WorkItem>,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  async list(actor: AuthenticatedPrincipal, projectId: string): Promise<WorkItemResponse[]> {
    await this.projectAccess.findReadableProjectOrThrow(actor, projectId);
    const items = await this.items.find({ where: { projectId }, order: { createdAt: 'ASC', id: 'ASC' } });
    return items.map(toWorkItemResponse);
  }

  async detail(actor: AuthenticatedPrincipal, projectId: string, itemId: string): Promise<WorkItemResponse> {
    await this.projectAccess.findReadableProjectOrThrow(actor, projectId);
    return toWorkItemResponse(await this.findInProjectOrThrow(projectId, itemId));
  }

  async create(actor: AuthenticatedPrincipal, projectId: string, input: CreateWorkItemDto): Promise<WorkItemResponse> {
    await this.assertWritable(actor, projectId);
    const item = this.items.create({
      projectId,
      type: input.type,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? WorkItemStatus.Todo,
      priority: input.priority ?? WorkItemPriority.Medium,
      dueDate: input.dueDate ?? null,
      assigneeId: null,
      labels: input.labels ?? [],
    });
    return toWorkItemResponse(await this.items.save(item));
  }

  async update(actor: AuthenticatedPrincipal, projectId: string, itemId: string, input: UpdateWorkItemDto): Promise<WorkItemResponse> {
    await this.assertWritable(actor, projectId);
    const item = await this.findInProjectOrThrow(projectId, itemId);
    Object.assign(item, input);
    return toWorkItemResponse(await this.items.save(item));
  }

  async remove(actor: AuthenticatedPrincipal, projectId: string, itemId: string): Promise<void> {
    await this.assertWritable(actor, projectId);
    const item = await this.findInProjectOrThrow(projectId, itemId);
    await this.items.remove(item);
  }

  private async findInProjectOrThrow(projectId: string, itemId: string): Promise<WorkItem> {
    const item = await this.items.findOne({ where: { id: itemId, projectId } });
    if (!item || item.projectId !== projectId) {
      throw new NotFoundException({ code: 'WORK_ITEM_NOT_FOUND', message: 'Không tìm thấy công việc' });
    }
    return item;
  }

  private async assertWritable(actor: AuthenticatedPrincipal, projectId: string): Promise<void> {
    const { project, accessRole } = await this.projectAccess.findReadableProjectOrThrow(actor, projectId);
    if (accessRole === ProjectAccessRole.AdminViewer) {
      throw new ForbiddenException({ code: 'WORK_ITEM_FORBIDDEN', message: 'Không có quyền sửa công việc' });
    }
    if (project.archivedAt || project.deletedAt) {
      throw new ConflictException({ code: 'PROJECT_LOCKED', message: 'Dự án đã khóa công việc' });
    }
  }
}
