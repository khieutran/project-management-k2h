import type { ProjectStatus } from '../project.types';

const STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: 'Lập kế hoạch', ACTIVE: 'Đang hoạt động', COMPLETED: 'Hoàn thành',
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}>{STATUS_LABELS[status]}</span>;
}
