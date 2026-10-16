import type { Project } from '../entities/project.entity';
import type { ProjectAccessRole } from '../enums/project-access-role.enum';
import type { ProjectResponse } from '../types/project-response.type';

export function toProjectResponse(
  project: Project,
  accessRole: ProjectAccessRole,
): ProjectResponse {
  if (!project.owner) {
    throw new Error('Project owner must be loaded before mapping the response');
  }

  return {
    id: project.id,
    key: project.key,
    name: project.name,
    description: project.description,
    status: project.status,
    startDate: project.startDate,
    endDate: project.endDate,
    archivedAt: project.archivedAt?.toISOString() ?? null,
    deletedAt: project.deletedAt?.toISOString() ?? null,
    accessRole,
    owner: {
      id: project.owner.id,
      displayName: project.owner.displayName,
    },
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}
