import { Link, useParams, useSearchParams } from 'react-router-dom';

import { ProjectAccessBadge } from '../components/ProjectAccessBadge';
import { ProjectActions } from '../components/ProjectActions';
import { ProjectMembersSection } from '../components/ProjectMembersSection';
import { ProjectPageShell } from '../components/ProjectPageShell';
import { ProjectStatusBadge } from '../components/ProjectStatusBadge';
import { useProject } from '../hooks/use-projects';
import type { ProjectStatus } from '../project.types';

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
  const [params] = useSearchParams();
  const projectQuery = useProject(projectId, params.get('includeDeleted') === 'true');
  const project = projectQuery.data;

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
