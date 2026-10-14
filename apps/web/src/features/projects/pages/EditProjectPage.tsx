import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../../../auth/use-auth';
import { ProjectForm } from '../components/ProjectForm';
import { ProjectPageShell } from '../components/ProjectPageShell';
import { useProjectMutations } from '../hooks/use-project-mutations';
import { useProject } from '../hooks/use-projects';
import { getProjectErrorMessage } from '../project-error-message';
import type { CreateProjectInput, UpdateProjectInput } from '../project.types';

export function EditProjectPage() {
  const { state } = useAuth();
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const projectQuery = useProject(projectId);
  const { updateProject } = useProjectMutations();
  const [error, setError] = useState<string>();
  if (state.status !== 'authenticated') return null;

  async function submit(input: CreateProjectInput | UpdateProjectInput): Promise<void> {
    setError(undefined);
    try {
      await updateProject.mutateAsync({ projectId, input: input as UpdateProjectInput });
      navigate(`/projects/${projectId}`);
    } catch (caught) {
      setError(getProjectErrorMessage(caught));
    }
  }

  if (projectQuery.data && projectQuery.data.owner.id !== state.user.id) return <Navigate to={`/projects/${projectId}`} replace />;

  return <ProjectPageShell><Link to={`/projects/${projectId}`}>← Chi tiết dự án</Link>{projectQuery.isPending ? <p role="status">Đang tải dự án...</p> : null}{projectQuery.isError ? <p role="alert">Không thể tải dự án.</p> : null}{projectQuery.data ? <section className="form-card"><h1>Chỉnh sửa {projectQuery.data.name}</h1><ProjectForm mode="edit" initialValues={{ key: projectQuery.data.key, name: projectQuery.data.name, description: projectQuery.data.description ?? '', startDate: projectQuery.data.startDate ?? '', endDate: projectQuery.data.endDate ?? '' }} isSubmitting={updateProject.isPending} serverError={error} onSubmit={submit} /></section> : null}</ProjectPageShell>;
}
