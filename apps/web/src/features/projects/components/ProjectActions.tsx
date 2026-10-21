import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useProjectMutations } from '../hooks/use-project-mutations';
import type { Project, ProjectStatus } from '../project.types';
import { DeleteProjectDialog } from './DeleteProjectDialog';

export function ProjectActions({ project }: { project: Project }) {
  const navigate = useNavigate();
  const mutations = useProjectMutations();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const pending = mutations.changeStatus.isPending || mutations.archive.isPending || mutations.restore.isPending;
  const nextStatus: ProjectStatus = project.status === 'PLANNING' ? 'ACTIVE' : project.status === 'ACTIVE' ? 'COMPLETED' : 'ACTIVE';
  const statusLabel = project.status === 'PLANNING' ? 'Bắt đầu dự án' : project.status === 'ACTIVE' ? 'Đánh dấu hoàn thành' : 'Mở lại dự án';

  useEffect(() => {
    if (!menuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };

    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOnOutsideClick);
    };
  }, [menuOpen]);

  return (
    <div className="project-actions">
      {!project.archivedAt && !project.deletedAt ? (
        <Link className="workspace-primary-action" to={`/projects/${project.id}/edit`}>Chỉnh sửa dự án</Link>
      ) : null}
      {project.archivedAt && !project.deletedAt ? (
        <button className="workspace-primary-action" type="button" disabled={pending} onClick={() => void mutations.restore.mutateAsync(project.id)}>Khôi phục dự án</button>
      ) : null}
      {!project.deletedAt && !project.archivedAt ? (
        <div className="project-action-menu" ref={menuRef}>
          <button
            ref={menuButtonRef}
            className="project-action-toggle"
            type="button"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? 'project-action-options' : undefined}
            onClick={() => setMenuOpen((open) => !open)}
          >
            Tùy chọn dự án <span aria-hidden="true">⌄</span>
          </button>
          {menuOpen ? (
            <div id="project-action-options" className="project-action-options">
              <button type="button" disabled={pending} onClick={() => { setMenuOpen(false); void mutations.changeStatus.mutateAsync({ projectId: project.id, status: nextStatus }); }}>{statusLabel}</button>
              <button type="button" disabled={pending} onClick={() => { setMenuOpen(false); void mutations.archive.mutateAsync(project.id); }}>Lưu trữ dự án</button>
              <button className="danger-link" type="button" onClick={() => { setMenuOpen(false); setShowDelete(true); }}>Xóa dự án</button>
            </div>
          ) : null}
        </div>
      ) : null}
      {showDelete ? (
        <DeleteProjectDialog
          projectName={project.name}
          isPending={mutations.deleteProject.isPending}
          onCancel={() => setShowDelete(false)}
          onConfirm={() => void mutations.deleteProject.mutateAsync(project.id).then(() => navigate('/projects'))}
        />
      ) : null}
    </div>
  );
}
