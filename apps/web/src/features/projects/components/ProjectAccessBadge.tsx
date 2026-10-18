import type { ProjectAccessRole } from '../project.types';

const ACCESS_ROLE_LABELS: Record<ProjectAccessRole, string> = {
  OWNER: 'Chủ sở hữu',
  MANAGER: 'Quản lý',
  MEMBER: 'Thành viên',
  ADMIN_VIEWER: 'Quản trị · Chỉ xem',
};

export function ProjectAccessBadge({
  accessRole,
}: {
  accessRole: ProjectAccessRole;
}) {
  return (
    <span
      className={`access-badge access-${accessRole.toLowerCase().replace('_', '-')}`}
    >
      {ACCESS_ROLE_LABELS[accessRole]}
    </span>
  );
}
