import type { ProjectResponse } from './project-response.type';

export type ProjectPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PaginatedProjects = {
  data: ProjectResponse[];
  pagination: ProjectPagination;
};
