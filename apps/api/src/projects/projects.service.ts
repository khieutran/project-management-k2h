import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, type Repository } from 'typeorm';

import type { AuthenticatedPrincipal } from '../auth/types/authenticated-principal.type';
import { UserRole } from '../users/enums/user-role.enum';
import type { CreateProjectDto } from './dto/create-project.dto';
import type { ChangeProjectStatusDto } from './dto/change-project-status.dto';
import {
  type ListProjectsQueryDto,
  ProjectListView,
} from './dto/list-projects-query.dto';
import type { UpdateProjectDto } from './dto/update-project.dto';
import { Project } from './entities/project.entity';
import { ProjectAccessRole } from './enums/project-access-role.enum';
import { ProjectStatus } from './enums/project-status.enum';
import { toProjectResponse } from './mappers/to-project-response';
import { ProjectAccessService } from './project-access.service';
import type { PaginatedProjects } from './types/paginated-projects.type';
import type { ProjectResponse } from './types/project-response.type';

const ALLOWED_STATUS_TRANSITIONS: Readonly<
  Record<ProjectStatus, readonly ProjectStatus[]>
> = {
  [ProjectStatus.Planning]: [ProjectStatus.Active],
  [ProjectStatus.Active]: [ProjectStatus.Completed],
  [ProjectStatus.Completed]: [ProjectStatus.Active],
};

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    private readonly dataSource: DataSource,
    private readonly projectAccessService: ProjectAccessService,
  ) {}

  async create(
    actor: AuthenticatedPrincipal,
    input: CreateProjectDto,
  ): Promise<ProjectResponse> {
    this.assertValidDateRange(input.startDate ?? null, input.endDate ?? null);

    const project = this.projectsRepository.create({
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      ownerId: actor.userId,
      status: ProjectStatus.Planning,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
    });

    let savedProject: Project;

    try {
      savedProject = await this.projectsRepository.save(project);
    } catch (error) {
      if (this.isPostgresUniqueViolation(error)) {
        throw this.createProjectKeyConflict();
      }

      throw error;
    }

    const projectWithOwner = await this.projectsRepository.findOne({
      where: { id: savedProject.id },
      relations: { owner: true },
    });

    if (!projectWithOwner) {
      throw new Error('Created project could not be reloaded');
    }

    return toProjectResponse(projectWithOwner, ProjectAccessRole.Owner);
  }

  async findAll(
    actor: AuthenticatedPrincipal,
    query: ListProjectsQueryDto,
  ): Promise<PaginatedProjects> {
    if (
      query.view === ProjectListView.Deleted &&
      actor.role !== UserRole.Admin
    ) {
      throw this.createDeletedViewForbidden();
    }

    const queryBuilder = this.projectsRepository
      .createQueryBuilder('project')
      .innerJoinAndSelect('project.owner', 'owner')
      .leftJoinAndSelect(
        'project.members',
        'actorMembership',
        'actorMembership.userId = :actorUserId',
        { actorUserId: actor.userId },
      );

    if (actor.role !== UserRole.Admin) {
      queryBuilder.andWhere(
        '(project.ownerId = :actorUserId OR actorMembership.userId = :actorUserId)',
        { actorUserId: actor.userId },
      );
    }

    if (query.view === ProjectListView.Current) {
      queryBuilder.andWhere('project.archivedAt IS NULL');
    } else if (query.view === ProjectListView.Archived) {
      queryBuilder.andWhere('project.archivedAt IS NOT NULL');
    } else {
      queryBuilder.withDeleted().andWhere('project.deletedAt IS NOT NULL');
    }

    if (query.status) {
      queryBuilder.andWhere('project.status = :status', {
        status: query.status,
      });
    }

    if (query.search) {
      const escapedSearch = this.escapeLikePattern(query.search);

      queryBuilder.andWhere(
        "(project.name ILIKE :search ESCAPE '\\' OR project.key ILIKE :search ESCAPE '\\')",
        { search: `%${escapedSearch}%` },
      );
    }

    queryBuilder
      .orderBy('project.updatedAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [projects, total] = await queryBuilder.getManyAndCount();

    return {
      data: projects.map((project) => {
        const membership = project.members?.[0] ?? null;
        const accessRole = this.projectAccessService.resolveAccessRole(
          actor,
          project,
          membership,
        );

        if (!accessRole) {
          throw new Error('Readable project must resolve an access role');
        }

        return toProjectResponse(project, accessRole);
      }),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(
    actor: AuthenticatedPrincipal,
    projectId: string,
    options: { includeDeleted: boolean },
  ): Promise<ProjectResponse> {
    const { project, accessRole } =
      await this.projectAccessService.findReadableProjectOrThrow(
        actor,
        projectId,
        options,
      );

    return toProjectResponse(project, accessRole);
  }

  async update(
    actor: AuthenticatedPrincipal,
    projectId: string,
    input: UpdateProjectDto,
  ): Promise<ProjectResponse> {
    if (!this.hasUpdateFields(input)) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Phải cung cấp ít nhất một trường để cập nhật',
      });
    }

    return this.dataSource.transaction(async (entityManager) => {
      const repository = entityManager.getRepository(Project);
      const project = await this.findOwnedProjectOrThrow(
        repository,
        actor,
        projectId,
      );

      this.assertProjectIsMutable(project);

      const nextStartDate =
        input.startDate !== undefined ? input.startDate : project.startDate;
      const nextEndDate =
        input.endDate !== undefined ? input.endDate : project.endDate;

      this.assertValidDateRange(nextStartDate, nextEndDate);

      if (input.name !== undefined) {
        project.name = input.name;
      }
      if (input.description !== undefined) {
        project.description = input.description;
      }
      if (input.startDate !== undefined) {
        project.startDate = input.startDate;
      }
      if (input.endDate !== undefined) {
        project.endDate = input.endDate;
      }

      const savedProject = await repository.save(project);

      return toProjectResponse(savedProject, ProjectAccessRole.Owner);
    });
  }

  async changeStatus(
    actor: AuthenticatedPrincipal,
    projectId: string,
    input: ChangeProjectStatusDto,
  ): Promise<ProjectResponse> {
    return this.dataSource.transaction(async (entityManager) => {
      const repository = entityManager.getRepository(Project);
      const project = await this.findOwnedProjectOrThrow(
        repository,
        actor,
        projectId,
      );

      this.assertProjectIsMutable(project);
      this.assertStatusTransition(project.status, input.status);

      project.status = input.status;

      const savedProject = await repository.save(project);

      return toProjectResponse(savedProject, ProjectAccessRole.Owner);
    });
  }

  async archive(
    actor: AuthenticatedPrincipal,
    projectId: string,
  ): Promise<ProjectResponse> {
    return this.dataSource.transaction(async (entityManager) => {
      const repository = entityManager.getRepository(Project);
      const project = await this.findOwnedProjectOrThrow(
        repository,
        actor,
        projectId,
      );

      if (project.archivedAt) {
        return toProjectResponse(project, ProjectAccessRole.Owner);
      }

      project.archivedAt = new Date();

      return toProjectResponse(
        await repository.save(project),
        ProjectAccessRole.Owner,
      );
    });
  }

  async restore(
    actor: AuthenticatedPrincipal,
    projectId: string,
  ): Promise<ProjectResponse> {
    return this.dataSource.transaction(async (entityManager) => {
      const repository = entityManager.getRepository(Project);
      const project = await this.findOwnedProjectOrThrow(
        repository,
        actor,
        projectId,
      );

      if (!project.archivedAt) {
        return toProjectResponse(project, ProjectAccessRole.Owner);
      }

      project.archivedAt = null;

      return toProjectResponse(
        await repository.save(project),
        ProjectAccessRole.Owner,
      );
    });
  }

  async delete(
    actor: AuthenticatedPrincipal,
    projectId: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (entityManager) => {
      const repository = entityManager.getRepository(Project);
      const project = await this.findOwnedProjectOrThrow(
        repository,
        actor,
        projectId,
      );

      project.deletedAt = new Date();

      await repository.save(project);
    });
  }

  private async findOwnedProjectOrThrow(
    repository: Repository<Project>,
    actor: AuthenticatedPrincipal,
    projectId: string,
  ): Promise<Project> {
    const project = await repository
      .createQueryBuilder('project')
      .innerJoinAndSelect('project.owner', 'owner')
      .andWhere('project.id = :projectId', { projectId })
      .andWhere('project.ownerId = :ownerId', { ownerId: actor.userId })
      .setLock('pessimistic_write')
      .getOne();

    if (!project) {
      throw this.createProjectNotFound();
    }

    return project;
  }

  private hasUpdateFields(input: UpdateProjectDto): boolean {
    return (
      input.name !== undefined ||
      input.description !== undefined ||
      input.startDate !== undefined ||
      input.endDate !== undefined
    );
  }

  private assertProjectIsMutable(project: Project): void {
    if (project.archivedAt) {
      throw new ConflictException({
        code: 'PROJECT_ARCHIVED',
        message: 'Project đã được archive',
      });
    }
  }

  private assertStatusTransition(
    currentStatus: ProjectStatus,
    nextStatus: ProjectStatus,
  ): void {
    if (!ALLOWED_STATUS_TRANSITIONS[currentStatus].includes(nextStatus)) {
      throw new ConflictException({
        code: 'PROJECT_INVALID_STATUS_TRANSITION',
        message: `Không thể chuyển trạng thái từ ${currentStatus} sang ${nextStatus}`,
      });
    }
  }

  private assertValidDateRange(
    startDate: string | null,
    endDate: string | null,
  ): void {
    if (startDate && endDate && endDate < startDate) {
      throw new ConflictException({
        code: 'PROJECT_INVALID_DATE_RANGE',
        message: 'Ngày kết thúc không được nhỏ hơn ngày bắt đầu',
      });
    }
  }

  private escapeLikePattern(value: string): string {
    return value.replace(/[\\%_]/g, '\\$&');
  }

  private isPostgresUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = error.driverError as Error & { code?: string };

    return driverError.code === '23505';
  }

  private createProjectKeyConflict(): ConflictException {
    return new ConflictException({
      code: 'PROJECT_KEY_ALREADY_EXISTS',
      message: 'Mã project đã tồn tại',
    });
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
