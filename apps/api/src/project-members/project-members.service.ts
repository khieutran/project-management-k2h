import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, type Repository } from 'typeorm';

import type { AuthenticatedPrincipal } from '../auth/types/authenticated-principal.type';
import { ProjectAccessService } from '../projects/project-access.service';
import { UsersService } from '../users/users.service';
import type { AddProjectMemberDto } from './dto/add-project-member.dto';
import { ProjectMember } from './entities/project-member.entity';
import {
  toProjectMemberResponse,
  toProjectOwnerMemberResponse,
} from './mappers/to-project-member-response';
import type { ProjectMemberResponse } from './types/project-member-response.type';

@Injectable()
export class ProjectMembersService {
  constructor(
    @InjectRepository(ProjectMember)
    private readonly membersRepository: Repository<ProjectMember>,
    private readonly dataSource: DataSource,
    private readonly projectAccessService: ProjectAccessService,
    private readonly usersService: UsersService,
  ) {}

  async findAll(
    actor: AuthenticatedPrincipal,
    projectId: string,
  ): Promise<{ data: ProjectMemberResponse[] }> {
    const { project } =
      await this.projectAccessService.findReadableProjectOrThrow(
        actor,
        projectId,
      );
    const memberships = await this.membersRepository.find({
      where: { projectId },
      relations: { user: true },
      order: { joinedAt: 'ASC' },
    });

    return {
      data: [
        toProjectOwnerMemberResponse(project),
        ...memberships.map((membership) =>
          toProjectMemberResponse(membership),
        ),
      ],
    };
  }

  async add(
    actor: AuthenticatedPrincipal,
    projectId: string,
    input: AddProjectMemberDto,
  ): Promise<ProjectMemberResponse> {
    return this.dataSource.transaction(async (entityManager) => {
      const project =
        await this.projectAccessService.findOwnedMutableProjectOrThrow(
          actor,
          projectId,
          entityManager,
        );
      const normalizedEmail = input.email.trim().toLowerCase();
      const user = await this.usersService.findByEmail(
        normalizedEmail,
        entityManager,
      );

      if (!user) {
        throw new NotFoundException({
          code: 'PROJECT_MEMBER_USER_NOT_FOUND',
          message: 'Không tìm thấy người dùng đã đăng ký',
        });
      }

      if (user.id === project.ownerId) {
        throw new BadRequestException({
          code: 'PROJECT_MEMBER_OWNER_CANNOT_BE_ADDED',
          message: 'Owner không thể được thêm làm thành viên',
        });
      }

      const repository = entityManager.getRepository(ProjectMember);
      const existingMembership = await repository.findOneBy({
        projectId,
        userId: user.id,
      });

      if (existingMembership) {
        throw this.createAlreadyExistsConflict();
      }

      const membership = repository.create({
        projectId,
        userId: user.id,
        user,
        role: input.role,
      });

      try {
        return toProjectMemberResponse(await repository.save(membership));
      } catch (error) {
        if (this.isPostgresUniqueViolation(error)) {
          throw this.createAlreadyExistsConflict();
        }

        throw error;
      }
    });
  }

  private isPostgresUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = error.driverError as Error & { code?: string };

    return driverError.code === '23505';
  }

  private createAlreadyExistsConflict(): ConflictException {
    return new ConflictException({
      code: 'PROJECT_MEMBER_ALREADY_EXISTS',
      message: 'Người dùng đã là thành viên của dự án',
    });
  }
}
