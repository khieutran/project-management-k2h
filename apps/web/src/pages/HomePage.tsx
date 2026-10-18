import { Link } from 'react-router-dom';

import { useAuth } from '../auth/use-auth';
import { ProjectPageShell } from '../features/projects/components/ProjectPageShell';
import { ProjectStatusBadge } from '../features/projects/components/ProjectStatusBadge';
import { useProjects } from '../features/projects/hooks/use-projects';
import type { ProjectListQuery, ProjectStatus } from '../features/projects/project.types';

const RECENT_QUERY: ProjectListQuery = { page: 1, limit: 5, view: 'current' };

function statusQuery(status: ProjectStatus): ProjectListQuery {
  return { page: 1, limit: 1, view: 'current', status };
}

function formatUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

export function HomePage() {
  const { state } = useAuth();
  const recent = useProjects(RECENT_QUERY);
  const active = useProjects(statusQuery('ACTIVE'));
  const planning = useProjects(statusQuery('PLANNING'));
  const completed = useProjects(statusQuery('COMPLETED'));

  if (state.status !== 'authenticated') return null;

  const summaries = [
    { label: 'Đang hoạt động', count: active.data?.pagination.total },
    { label: 'Lập kế hoạch', count: planning.data?.pagination.total },
    { label: 'Hoàn thành', count: completed.data?.pagination.total },
  ];

  return (
    <ProjectPageShell>
      <div className="workspace-page-heading">
        <div>
          <p className="workspace-page-context">Không gian làm việc</p>
          <h1>Tổng quan</h1>
          <p className="workspace-page-intro">Tình trạng các dự án của bạn, cập nhật từ hệ thống.</p>
        </div>
        <Link className="workspace-primary-action" to="/projects/new">Tạo dự án</Link>
      </div>

      <section className="overview-summary" aria-label="Tình trạng dự án">
        {summaries.map(({ label, count }) => (
          <div className="overview-summary-item" key={label}>
            <span>{label}</span>
            <strong>{count ?? '—'}</strong>
          </div>
        ))}
      </section>

      <section className="overview-projects" aria-labelledby="recent-projects-title">
        <div className="overview-section-heading">
          <div>
            <h2 id="recent-projects-title">Dự án gần đây</h2>
            <p>Tiếp tục từ nơi bạn đang làm việc.</p>
          </div>
          <Link to="/projects">Xem tất cả dự án <span aria-hidden="true">↗</span></Link>
        </div>

        {recent.isPending ? <p className="workspace-state" role="status">Đang tải dự án...</p> : null}
        {recent.isError ? (
          <div className="workspace-state" role="alert">
            <p>Không thể tải dự án gần đây.</p>
            <button className="secondary-button" type="button" onClick={() => void recent.refetch()}>Thử lại</button>
          </div>
        ) : null}
        {recent.data && recent.data.data.length === 0 ? (
          <div className="workspace-state">
            <h3>Chưa có dự án nào</h3>
            <p>Tạo dự án đầu tiên để bắt đầu quản lý cùng nhóm của bạn.</p>
            <Link to="/projects/new">Tạo dự án</Link>
          </div>
        ) : null}
        {recent.data?.data.length ? (
          <ul className="overview-project-list">
            {recent.data.data.map((project) => (
              <li key={project.id}>
                <Link to={`/projects/${project.id}`}>
                  <span className="overview-project-identity">
                    <span className="overview-project-key">{project.key}</span>
                    <strong>{project.name}</strong>
                  </span>
                  <ProjectStatusBadge status={project.status} />
                  <span className="overview-project-date">Cập nhật {formatUpdatedAt(project.updatedAt)}</span>
                  <span className="overview-project-arrow" aria-hidden="true">↗</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </ProjectPageShell>
  );
}
