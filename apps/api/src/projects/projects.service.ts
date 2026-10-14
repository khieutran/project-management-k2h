import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, type Repository } from 'typeorm';

import type { AuthenticatedPrincipal } from '../auth/types/authenticated-principal.type';
import { UserRole } from '../users/enums/user-role.enum';
import type { CreateProjectDto } from './dto/create-project.dto';
import {
  type ListProjectsQueryDto,
  ProjectListView,
} from './dto/list-projects-query.dto';
import { Project } from './entities/project.entity';
import { ProjectStatus } from './enums/project-status.enum';
import { toProjectResponse } from './mappers/to-project-response';
import type { PaginatedProjects } from './types/paginated-projects.type';
import type { ProjectResponse } from './types/project-response.type';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
  ) {}

  async create(
    actor: AuthenticatedPrincipal,
    input: CreateProjectDto,
  ): Promise<ProjectResponse> {
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

    return toProjectResponse(projectWithOwner);
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
      .innerJoinAndSelect('project.owner', 'owner');

    if (actor.role !== UserRole.Admin) {
      queryBuilder.andWhere('project.ownerId = :ownerId', {
        ownerId: actor.userId,
      });
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
      data: projects.map((project) => toProjectResponse(project)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
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

  private createDeletedViewForbidden(): ForbiddenException {
    return new ForbiddenException({
      code: 'PROJECT_DELETED_VIEW_FORBIDDEN',
      message: 'Chỉ ADMIN được xem project đã xóa',
    });
  }
}
