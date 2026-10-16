import { useProjectMembers } from '../hooks/use-project-members';
import type { Project } from '../project.types';
import { ProjectMemberRow } from './ProjectMemberRow';

export function ProjectMembersSection({ project }: { project: Project }) {
  const membersQuery = useProjectMembers(project.id);
  const isReadOnly =
    project.accessRole === 'ADMIN_VIEWER' ||
    Boolean(project.archivedAt || project.deletedAt);

  return (
    <section className="project-members" aria-labelledby="project-members-title">
      <div className="project-members-heading">
        <div>
          <p className="section-eyebrow">Project access</p>
          <h2 id="project-members-title">Thành viên</h2>
        </div>
      </div>

      {isReadOnly ? (
        <p className="readonly-note">
          Danh sách thành viên đang ở chế độ chỉ xem.
        </p>
      ) : null}

      {membersQuery.isPending ? (
        <p role="status">Đang tải thành viên...</p>
      ) : null}

      {membersQuery.isError ? (
        <div className="state-panel member-state-panel" role="alert">
          <p>Không thể tải danh sách thành viên.</p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void membersQuery.refetch()}
          >
            Thử lại
          </button>
        </div>
      ) : null}

      {membersQuery.data?.data.length === 0 ? (
        <p className="empty-state">Dự án chưa có thành viên.</p>
      ) : null}

      {membersQuery.data && membersQuery.data.data.length > 0 ? (
        <ul className="project-member-list" aria-label="Thành viên dự án">
          {membersQuery.data.data.map((member) => (
            <ProjectMemberRow key={member.user.id} member={member} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
