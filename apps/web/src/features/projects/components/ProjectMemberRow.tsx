import type { ProjectMember, ProjectMemberRole } from '../project.types';
import { ProjectAccessBadge } from './ProjectAccessBadge';

type ProjectMemberRowProps = {
  member: ProjectMember;
  canManage?: boolean;
  isPending?: boolean;
  onChangeRole?(role: ProjectMemberRole): void;
  onRequestRemove?(): void;
};

export function ProjectMemberRow({
  member,
  canManage = false,
  isPending = false,
  onChangeRole,
  onRequestRemove,
}: ProjectMemberRowProps) {
  const showControls = canManage && member.role !== 'OWNER';

  return (
    <li className="project-member-row">
      <div className="project-member-identity">
        <strong>{member.user.displayName}</strong>
        <span>{member.user.email}</span>
      </div>
      {showControls ? (
        <div className="project-member-controls">
          <label>
            <span className="sr-only">
              Vai trò của {member.user.displayName}
            </span>
            <select
              aria-label={`Vai trò của ${member.user.displayName}`}
              value={member.role}
              disabled={isPending}
              onChange={(event) =>
                onChangeRole?.(event.target.value as ProjectMemberRole)
              }
            >
              <option value="MEMBER">Member</option>
              <option value="MANAGER">Manager</option>
            </select>
          </label>
          <button
            className="member-remove-button"
            type="button"
            disabled={isPending}
            aria-label={`Xóa ${member.user.displayName}`}
            onClick={onRequestRemove}
          >
            Xóa
          </button>
        </div>
      ) : (
        <ProjectAccessBadge accessRole={member.role} />
      )}
    </li>
  );
}
