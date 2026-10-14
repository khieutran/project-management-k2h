import { type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../../auth/use-auth';
import { ProjectList } from '../components/ProjectList';
import { ProjectPageShell } from '../components/ProjectPageShell';
import { useProjects } from '../hooks/use-projects';
import type { ProjectListQuery, ProjectListView, ProjectStatus } from '../project.types';

const STATUS_VALUES = new Set<ProjectStatus>(['PLANNING', 'ACTIVE', 'COMPLETED']);
const VIEW_VALUES = new Set<ProjectListView>(['current', 'archived', 'deleted']);

export function ProjectsPage() {
  const { state } = useAuth();
  const [params, setParams] = useSearchParams();
  const isAdmin = state.status === 'authenticated' && state.user.role === 'ADMIN';

  const rawView = params.get('view');
  const requestedView = rawView && VIEW_VALUES.has(rawView as ProjectListView) ? rawView as ProjectListView : 'current';
  const view = requestedView === 'deleted' && !isAdmin ? 'current' : requestedView;
  const rawStatus = params.get('status');
  const query: ProjectListQuery = {
    page: Math.max(1, Number(params.get('page')) || 1),
    limit: 20,
    view,
    ...(params.get('search') ? { search: params.get('search') ?? undefined } : {}),
    ...(rawStatus && STATUS_VALUES.has(rawStatus as ProjectStatus) ? { status: rawStatus as ProjectStatus } : {}),
  };
  const projects = useProjects(query);

  if (state.status !== 'authenticated') return null;

  function setQuery(changes: Record<string, string | undefined>): void {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    setParams(next);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setQuery({ search: String(data.get('search') ?? '').trim() || undefined, page: undefined });
  }

  return (
    <ProjectPageShell>
      <div className="page-heading"><div><p className="home-eyebrow">Workspace</p><h1>Dự án</h1></div><Link className="primary-link" to="/projects/new">Tạo dự án</Link></div>
      <nav className="project-tabs" aria-label="Phạm vi dự án">
        <Link className={view === 'current' ? 'active' : ''} to="/projects?view=current">Hiện tại</Link>
        <Link className={view === 'archived' ? 'active' : ''} to="/projects?view=archived">Đã lưu trữ</Link>
        {isAdmin ? <Link className={view === 'deleted' ? 'active' : ''} to="/projects?view=deleted">Đã xóa</Link> : null}
      </nav>
      <form className="project-filters" onSubmit={submitSearch}>
        <label><span>Tìm dự án</span><input name="search" defaultValue={query.search} placeholder="Tên hoặc mã dự án" /></label>
        <label><span>Trạng thái</span><select value={query.status ?? ''} onChange={(e) => setQuery({ status: e.target.value || undefined, page: undefined })}><option value="">Tất cả</option><option value="PLANNING">Lập kế hoạch</option><option value="ACTIVE">Đang hoạt động</option><option value="COMPLETED">Hoàn thành</option></select></label>
        <button className="secondary-button" type="submit">Tìm kiếm</button>
      </form>
      {projects.isPending ? <p role="status">Đang tải dự án...</p> : null}
      {projects.isError ? <div className="state-panel" role="alert"><p>Không thể tải danh sách dự án.</p><button className="secondary-button" type="button" onClick={() => void projects.refetch()}>Thử lại</button></div> : null}
      {projects.data && projects.data.data.length === 0 ? <div className="state-panel"><h2>Chưa có dự án</h2><p>Tạo dự án đầu tiên để bắt đầu quản lý công việc.</p></div> : null}
      {projects.data?.data.length ? <ProjectList projects={projects.data.data} showOwner={isAdmin} /> : null}
      {projects.data && projects.data.pagination.totalPages > 1 ? <nav className="pagination" aria-label="Phân trang"><button type="button" disabled={query.page <= 1} onClick={() => setQuery({ page: String(query.page - 1) })}>Trang trước</button><span>Trang {query.page}/{projects.data.pagination.totalPages}</span><button type="button" disabled={query.page >= projects.data.pagination.totalPages} onClick={() => setQuery({ page: String(query.page + 1) })}>Trang sau</button></nav> : null}
    </ProjectPageShell>
  );
}
