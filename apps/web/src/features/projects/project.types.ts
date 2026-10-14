export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'COMPLETED';
export type ProjectListView = 'current' | 'archived' | 'deleted';

export type ProjectOwner = {
  id: string;
  displayName: string;
};

export type Project = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  archivedAt: string | null;
  deletedAt: string | null;
  owner: ProjectOwner;
  createdAt: string;
  updatedAt: string;
};

export type ProjectListQuery = {
  page: number;
  limit: number;
  search?: string;
  status?: ProjectStatus;
  view: ProjectListView;
};

export type PaginatedProjects = {
  data: Project[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type CreateProjectInput = {
  key: string;
  name: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

export type UpdateProjectInput = Omit<CreateProjectInput, 'key'>;
