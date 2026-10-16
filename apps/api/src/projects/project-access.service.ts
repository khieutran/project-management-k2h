import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';

import type { AuthenticatedPrincipal } from '../auth/types/authenticated-principal.type';
import type { ProjectMember } from '../project-members/entities/project-member.entity';
import { ProjectMemberRole } from '../project-members/enums/project-member-role.enum';
import { UserRole } from '../users/enums/user-role.enum';
import { Project } from './entities/project.entity';
import { ProjectAccessRole } from './enums/project-access-role.enum';

export type ProjectAccessContext = {
  project: Project;
  accessRole: ProjectAccessRole;
};

type ReadProjectOptions = {
  includeDeleted?: boolean;
  entityManager?: EntityManager;
};

@Injectable()
export class ProjectAccessService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
  ) {}

  async findReadableProjectOrThrow(
    actor: AuthenticatedPrincipal,
    projectId: string,
    options: ReadProjectOptions = {},
  ): Promise<ProjectAccessContext> {
    if (options.includeDeleted && actor.role !== UserRole.Admin) {
      throw this.createDeletedViewForbidden();
    }

    const repository = this.getProjectRepository(options.entityManager);
    const queryBuilder = repository
      .createQueryBuilder('project')
      .innerJoinAndSelect('project.owner', 'owner')
      .leftJoinAndSelect(
        'project.members',
        'actorMembership',
        'actorMembership.userId = :actorUserId',
        { actorUserId: actor.userId },
      )
      .andWhere('project.id = :projectId', { projectId });

    if (options.includeDeleted) {
      queryBuilder.withDeleted();
    }

    const project = await queryBuilder.getOne();

    if (!project) {
      throw this.createProjectNotFound();
    }

    const membership = project.members?.[0] ?? null;
    const accessRole = this.resolveAccessRole(actor, project, membership);

    if (!accessRole) {
      throw this.createProjectNotFound();
    }

    return { project, accessRole };
  }

  async findOwnedMutableProjectOrThrow(
    actor: AuthenticatedPrincipal,
    projectId: string,
    entityManager?: EntityManager,
  ): Promise<Project> {
    const repository = this.getProjectRepository(entityManager);
    const project = await repository
      .createQueryBuilder('project')
      .innerJoinAndSelect('project.owner', 'owner')
      .andWhere('project.id = :projectId', { projectId })
      .andWhere('project.ownerId = :ownerId', { ownerId: actor.userId })
      .withDeleted()
      .setLock('pessimistic_write')
      .getOne();

    if (!project) {
      throw this.createProjectNotFound();
    }

    if (project.archivedAt || project.deletedAt) {
      throw new ConflictException({
        code: 'PROJECT_MEMBERSHIP_LOCKED',
        message: 'Không thể thay đổi thành viên của project đã khóa',
      });
    }

    return project;
  }

  resolveAccessRole(
    actor: AuthenticatedPrincipal,
    project: Project,
    membership: ProjectMember | null,
  ): ProjectAccessRole | null {
    if (project.ownerId === actor.userId) {
      return ProjectAccessRole.Owner;
    }

    if (membership?.userId === actor.userId) {
      return membership.role === ProjectMemberRole.Manager
        ? ProjectAccessRole.Manager
        : ProjectAccessRole.Member;
    }

    if (actor.role === UserRole.Admin) {
      return ProjectAccessRole.AdminViewer;
    }

    return null;
  }

  private getProjectRepository(
    entityManager?: EntityManager,
  ): Repository<Project> {
    return entityManager
      ? entityManager.getRepository(Project)
      : this.projectsRepository;
  }

  private createProjectNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'PROJECT_NOT_FOUND',
      message: 'Không tìm thấy project',
    });
  }

  private createDeletedViewForbidden(): ForbiddenException {
    return new ForbiddenException({
      code: 'PROJECT_DELETED_VIEW_FORBIDDEN',
      message: 'Chỉ ADMIN được xem project đã xóa',
    });
  }
}
