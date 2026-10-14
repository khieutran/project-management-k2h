import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, type Repository } from 'typeorm';

import type { AuthenticatedPrincipal } from '../auth/types/authenticated-principal.type';
import type { CreateProjectDto } from './dto/create-project.dto';
import { Project } from './entities/project.entity';
import { ProjectStatus } from './enums/project-status.enum';
import { toProjectResponse } from './mappers/to-project-response';
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
}
