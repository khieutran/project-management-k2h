import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { ProjectAccessBadge } from '../components/ProjectAccessBadge';
import { ProjectContainer } from '../components/ProjectContainer';
import { ProjectActions } from '../components/ProjectActions';
import { ProjectMembersSection } from '../components/ProjectMembersSection';
import { ProjectPageShell } from '../components/ProjectPageShell';
import { ProjectStatusBadge } from '../components/ProjectStatusBadge';
import { useProject } from '../hooks/use-projects';
import type { ProjectStatus } from '../project.types';
import type { WorkItemType } from '../../work-items/work-item.types';
import { useWorkItemMutations, useWorkItems } from '../../work-items/use-work-items';
import { WorkItemDetail } from '../../work-items/WorkItemDetail';

import '../cargoyard.css';
import '../cargoyard-visual.css';

const STAGES: Array<{ status: ProjectStatus; label: string }> = [
  { status: 'PLANNING', label: 'Lập kế hoạch' },
  { status: 'ACTIVE', label: 'Đang hoạt động' },
  { status: 'COMPLETED', label: 'Hoàn thành' },
];

function formatProjectDate(value: string | null): string {
  if (!value) return 'Chưa thiết lập';
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

export function ProjectDetailPage() {
  const { projectId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const selectedItemId = params.get('item');
  const projectQuery = useProject(projectId, params.get('includeDeleted') === 'true');
  const project = projectQuery.data;
  const workItems = useWorkItems(projectId);
  const workItemMutations = useWorkItemMutations(projectId);
  const [creatingType, setCreatingType] = useState<WorkItemType | null>(null);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [itemError, setItemError] = useState('');
  const createDialog = useRef<HTMLDivElement>(null);
  const addButton = useRef<HTMLElement | null>(null);
  const canWriteItems = Boolean(project && project.accessRole !== 'ADMIN_VIEWER' && !project.archivedAt && !project.deletedAt);

  useEffect(() => {
    if (!creatingType) return;
    return () => addButton.current?.focus();
  }, [creatingType]);

  function handleCreateDialogKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setCreatingType(null);
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = Array.from(createDialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') ?? []);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  async function createItem(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!creatingType || !newItemTitle.trim()) return;
    setItemError('');
    try {
      await workItemMutations.create.mutateAsync({ type: creatingType, title: newItemTitle.trim() });
      setCreatingType(null);
      setNewItemTitle('');
    } catch {
      setItemError('Không thể tạo công việc. Vui lòng thử lại.');
    }
  }

  return (
    <ProjectPageShell>
      <nav className="project-breadcrumb" aria-label="Đường dẫn">
        <Link to="/projects">Dự án</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{project?.name ?? 'Chi tiết dự án'}</span>
      </nav>

      {projectQuery.isPending ? <p className="workspace-state" role="status">Đang tải dự án...</p> : null}
      {projectQuery.isError ? (
        <div className="workspace-state" role="alert">
          <p>Không thể tải dự án.</p>
          <button className="secondary-button" type="button" onClick={() => void projectQuery.refetch()}>Thử lại</button>
        </div>
      ) : null}

      {project ? (
        <div className="project-detail-page">
          <header className="project-detail-header">
            <div className="project-detail-title">
              <span className="project-detail-key">{project.key}</span>
              <h1>{project.name}</h1>
              <div className="project-detail-labels">
                <ProjectStatusBadge status={project.status} />
                <ProjectAccessBadge accessRole={project.accessRole} />
                {project.archivedAt ? <span className="project-lifecycle-label">Đã lưu trữ</span> : null}
                {project.deletedAt ? <span className="project-lifecycle-label">Đã xóa</span> : null}
              </div>
            </div>
            {project.accessRole === 'OWNER' ? (
              <ProjectActions project={project} />
            ) : (
              <p className="readonly-note">Chế độ chỉ xem</p>
            )}
          </header>

          {workItems.isPending ? <p role="status">Đang tải công việc...</p> : null}
          {workItems.isError ? <p role="alert">Không thể tải công việc. <button type="button" onClick={() => void workItems.refetch()}>Thử lại</button></p> : null}
          <ProjectContainer project={project} items={workItems.data ?? []} canWrite={canWriteItems} onAdd={(type) => {
            addButton.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            setCreatingType(type);
            setItemError('');
          }} />

          {creatingType ? (
            <div className="work-item-dialog-backdrop" role="presentation">
              <div className="work-item-create-dialog" ref={createDialog} onKeyDown={handleCreateDialogKeyDown} role="dialog" aria-modal="true" aria-label={`Tạo ${creatingType.toLowerCase()}`}>
                <div className="work-item-create-heading"><h2>Tạo {creatingType.toLowerCase()}</h2><button type="button" aria-label="Đóng" onClick={() => setCreatingType(null)}>×</button></div>
                <form onSubmit={(event) => void createItem(event)}>
                  <label htmlFor="work-item-title">Tên công việc</label>
                  <input id="work-item-title" autoFocus required maxLength={160} value={newItemTitle} onChange={(event) => setNewItemTitle(event.target.value)} />
                  {itemError ? <p role="alert">{itemError}</p> : null}
                  <div className="work-item-create-actions"><button type="button" onClick={() => setCreatingType(null)}>Hủy</button><button type="submit" disabled={workItemMutations.create.isPending}>Tạo {creatingType.toLowerCase()}</button></div>
                </form>
              </div>
            </div>
          ) : null}

          {selectedItemId ? <WorkItemDetail projectId={projectId} itemId={selectedItemId} canWrite={canWriteItems} onClose={() => {
            const next = new URLSearchParams(params);
            next.delete('item');
            setParams(next, { replace: true });
          }} /> : null}

          <div className="project-detail-grid">
            <section className="project-overview-panel" aria-labelledby="project-overview-title">
              <h2 id="project-overview-title">Tiến trình dự án</h2>
              <p className="project-overview-description">{project.description || 'Dự án chưa có mô tả.'}</p>
              <ol className="project-progress">
                {STAGES.map((stage, index) => {
                  const currentIndex = STAGES.findIndex((item) => item.status === project.status);
                  return (
                    <li className={index <= currentIndex ? 'is-reached' : ''} aria-current={index === currentIndex ? 'step' : undefined} key={stage.status}>
                      <span className="project-progress-marker" aria-hidden="true">{index + 1}</span>
                      <span>{stage.label}</span>
                    </li>
                  );
                })}
              </ol>
            </section>

            <aside className="project-facts" aria-labelledby="project-facts-title">
              <h2 id="project-facts-title">Thông tin dự án</h2>
              <dl>
                <div><dt>Chủ dự án</dt><dd>{project.owner.displayName}</dd></div>
                <div><dt>Bắt đầu</dt><dd>{formatProjectDate(project.startDate)}</dd></div>
                <div><dt>Kết thúc</dt><dd>{formatProjectDate(project.endDate)}</dd></div>
              </dl>
            </aside>
          </div>

          <ProjectMembersSection project={project} />
        </div>
      ) : null}
    </ProjectPageShell>
  );
}
