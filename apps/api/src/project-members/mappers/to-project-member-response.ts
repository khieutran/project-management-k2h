import type { Project } from '../../projects/entities/project.entity';
import type { User } from '../../users/entities/user.entity';
import type { ProjectMember } from '../entities/project-member.entity';
import type { ProjectMemberResponse } from '../types/project-member-response.type';

function toMemberUserResponse(user: User): ProjectMemberResponse['user'] {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
  };
}

export function toProjectMemberResponse(
  membership: ProjectMember,
): ProjectMemberResponse {
  if (!membership.user) {
    throw new Error(
      'Project member user must be loaded before mapping the response',
    );
  }

  return {
    user: toMemberUserResponse(membership.user),
    role: membership.role,
    joinedAt: membership.joinedAt.toISOString(),
  };
}

export function toProjectOwnerMemberResponse(
  project: Project,
): ProjectMemberResponse {
  if (!project.owner) {
    throw new Error(
      'Project owner must be loaded before mapping the member response',
    );
  }

  return {
    user: toMemberUserResponse(project.owner),
    role: 'OWNER',
    joinedAt: null,
  };
}
