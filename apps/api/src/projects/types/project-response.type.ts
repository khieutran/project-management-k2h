import type { ProjectStatus } from '../enums/project-status.enum';
import type { ProjectAccessRole } from '../enums/project-access-role.enum';

export type ProjectOwnerResponse = {
  id: string;
  displayName: string;
};

export type ProjectResponse = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  archivedAt: string | null;
  deletedAt: string | null;
  accessRole: ProjectAccessRole;
  owner: ProjectOwnerResponse;
  createdAt: string;
  updatedAt: string;
};
