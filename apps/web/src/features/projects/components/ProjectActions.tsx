import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useProjectMutations } from '../hooks/use-project-mutations';
import type { Project, ProjectStatus } from '../project.types';
import { DeleteProjectDialog } from './DeleteProjectDialog';

export function ProjectActions({ project }: { project: Project }) {
  const navigate = useNavigate();
  const mutations = useProjectMutations();
  const [showDelete, setShowDelete] = useState(false);
  const pending = mutations.changeStatus.isPending || mutations.archive.isPending || mutations.restore.isPending;
  const nextStatus: ProjectStatus = project.status === 'PLANNING' ? 'ACTIVE' : project.status === 'ACTIVE' ? 'COMPLETED' : 'ACTIVE';
  const statusLabel = project.status === 'PLANNING' ? 'Bắt đầu dự án' : project.status === 'ACTIVE' ? 'Hoàn thành' : 'Mở lại dự án';

  return <div className="project-actions">
    {!project.archivedAt && !project.deletedAt ? <><Link className="secondary-link" to={`/projects/${project.id}/edit`}>Chỉnh sửa</Link><button type="button" disabled={pending} onClick={() => void mutations.changeStatus.mutateAsync({ projectId: project.id, status: nextStatus })}>{statusLabel}</button><button type="button" disabled={pending} onClick={() => void mutations.archive.mutateAsync(project.id)}>Lưu trữ</button></> : null}
    {project.archivedAt && !project.deletedAt ? <button type="button" disabled={pending} onClick={() => void mutations.restore.mutateAsync(project.id)}>Khôi phục</button> : null}
    {!project.deletedAt ? <button className="danger-link" type="button" onClick={() => setShowDelete(true)}>Xóa</button> : null}
    {showDelete ? <DeleteProjectDialog projectName={project.name} isPending={mutations.deleteProject.isPending} onCancel={() => setShowDelete(false)} onConfirm={() => void mutations.deleteProject.mutateAsync(project.id).then(() => navigate('/projects'))} /> : null}
  </div>;
}
