import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../../auth/use-auth';
import { createProjectsApi } from '../api/projects-api';
import { ProjectForm } from '../components/ProjectForm';
import { ProjectPageShell } from '../components/ProjectPageShell';
import { useProjectMutations } from '../hooks/use-project-mutations';
import { getProjectErrorMessage } from '../project-error-message';
import type { CreateProjectInput, UpdateProjectInput } from '../project.types';

export function CreateProjectPage() {
  const navigate = useNavigate();
  const { request } = useAuth();
  const { createProject } = useProjectMutations();
  const [error, setError] = useState<string>();

  async function submit(input: CreateProjectInput | UpdateProjectInput): Promise<void> {
    setError(undefined);
    try {
      const project = await createProject.mutateAsync(input as CreateProjectInput);
      try {
        const yard = await createProjectsApi(request).list({ page: 1, limit: 7, view: 'current', sort: 'created_asc' });
        navigate(`/projects?view=current&page=${Math.max(1, yard.pagination.totalPages)}`, {
          state: { createdProjectId: project.id },
        });
      } catch {
        navigate(`/projects/${project.id}`);
      }
    } catch (caught) {
      setError(getProjectErrorMessage(caught));
    }
  }

  return <ProjectPageShell><Link to="/projects">← Danh sách dự án</Link><section className="form-card"><h1>Tạo dự án</h1><p>Mã dự án là định danh ngắn và không thể sửa sau khi tạo.</p><ProjectForm mode="create" isSubmitting={createProject.isPending} serverError={error} onSubmit={submit} /></section></ProjectPageShell>;
}
