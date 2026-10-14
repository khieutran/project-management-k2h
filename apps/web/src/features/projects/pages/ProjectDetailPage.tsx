import { Link, useParams, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../../auth/use-auth';
import { ProjectActions } from '../components/ProjectActions';
import { ProjectPageShell } from '../components/ProjectPageShell';
import { ProjectStatusBadge } from '../components/ProjectStatusBadge';
import { useProject } from '../hooks/use-projects';

export function ProjectDetailPage() {
  const { state } = useAuth();
  const { projectId = '' } = useParams();
  const [params] = useSearchParams();
  const projectQuery = useProject(projectId, params.get('includeDeleted') === 'true');
  if (state.status !== 'authenticated') return null;

  return <ProjectPageShell>
    <Link to="/projects">← Danh sách dự án</Link>
    {projectQuery.isPending ? <p role="status">Đang tải dự án...</p> : null}
    {projectQuery.isError ? <div className="state-panel" role="alert"><p>Không thể tải dự án.</p><button type="button" onClick={() => void projectQuery.refetch()}>Thử lại</button></div> : null}
    {projectQuery.data ? <article className="project-detail">
      <div className="page-heading"><div><p className="project-key">{projectQuery.data.key}</p><h1>{projectQuery.data.name}</h1></div><ProjectStatusBadge status={projectQuery.data.status} /></div>
      <p className="project-description">{projectQuery.data.description || 'Chưa có mô tả.'}</p>
      <dl className="project-metadata"><div><dt>Chủ dự án</dt><dd>{projectQuery.data.owner.displayName}</dd></div><div><dt>Ngày bắt đầu</dt><dd>{projectQuery.data.startDate || 'Chưa đặt'}</dd></div><div><dt>Ngày kết thúc</dt><dd>{projectQuery.data.endDate || 'Chưa đặt'}</dd></div></dl>
      {projectQuery.data.owner.id === state.user.id ? <ProjectActions project={projectQuery.data} /> : <p className="readonly-note">Chế độ chỉ xem</p>}
    </article> : null}
  </ProjectPageShell>;
}
