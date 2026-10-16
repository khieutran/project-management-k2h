import type { ProjectMemberRole } from '../enums/project-member-role.enum';

export type ProjectMemberResponseRole = ProjectMemberRole | 'OWNER';

export type ProjectMemberUserResponse = {
  id: string;
  email: string;
  displayName: string;
};

export type ProjectMemberResponse = {
  user: ProjectMemberUserResponse;
  role: ProjectMemberResponseRole;
  joinedAt: string | null;
};
