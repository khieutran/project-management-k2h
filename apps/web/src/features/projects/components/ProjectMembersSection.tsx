import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useProjectMemberMutations } from '../hooks/use-project-member-mutations';
import { useProjectMembers } from '../hooks/use-project-members';
import { getProjectErrorMessage } from '../project-error-message';
import type {
  AddProjectMemberInput,
  Project,
  ProjectMember,
  ProjectMemberRole,
} from '../project.types';
import { AddProjectMemberForm } from './AddProjectMemberForm';
import { LeaveProjectDialog } from './LeaveProjectDialog';
import { ProjectMemberRow } from './ProjectMemberRow';
import { RemoveProjectMemberDialog } from './RemoveProjectMemberDialog';

export function ProjectMembersSection({ project }: { project: Project }) {
  const navigate = useNavigate();
  const membersQuery = useProjectMembers(project.id);
  const mutations = useProjectMemberMutations();
  const [memberToRemove, setMemberToRemove] = useState<ProjectMember>();
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [mutationError, setMutationError] = useState<string>();
  const isReadOnly =
    project.accessRole === 'ADMIN_VIEWER' ||
    Boolean(project.archivedAt || project.deletedAt);
  const canManage = project.accessRole === 'OWNER' && !isReadOnly;
  const canLeave =
    (project.accessRole === 'MANAGER' || project.accessRole === 'MEMBER') &&
    !isReadOnly;

  async function addMember(input: AddProjectMemberInput): Promise<void> {
    await mutations.addMember.mutateAsync({ projectId: project.id, input });
  }

  async function changeMemberRole(
    member: ProjectMember,
    role: ProjectMemberRole,
  ) {
    setMutationError(undefined);

    try {
      await mutations.changeMemberRole.mutateAsync({
        projectId: project.id,
        userId: member.user.id,
        input: { role },
      });
    } catch (error) {
      setMutationError(getProjectErrorMessage(error));
    }
  }

  async function removeMember() {
    if (!memberToRemove) {
      return;
    }

    setMutationError(undefined);

    try {
      await mutations.removeMember.mutateAsync({
        projectId: project.id,
        userId: memberToRemove.user.id,
      });
      setMemberToRemove(undefined);
    } catch (error) {
      setMutationError(getProjectErrorMessage(error));
    }
  }

  async function leaveProject() {
    setMutationError(undefined);

    try {
      await mutations.leaveProject.mutateAsync(project.id);
      setShowLeaveDialog(false);
      navigate('/projects');
    } catch (error) {
      setMutationError(getProjectErrorMessage(error));
    }
  }

  return (
    <section className="project-members" aria-labelledby="project-members-title">
      <div className="project-members-heading">
        <div>
          <p className="section-eyebrow">Project access</p>
          <h2 id="project-members-title">Thành viên</h2>
        </div>
        {canLeave ? (
          <button
            className="danger-link"
            type="button"
            disabled={mutations.leaveProject.isPending}
            onClick={() => setShowLeaveDialog(true)}
          >
            Rời dự án
          </button>
        ) : null}
      </div>

      {isReadOnly ? (
        <p className="readonly-note">
          Danh sách thành viên đang ở chế độ chỉ xem.
        </p>
      ) : null}

      {canManage ? <AddProjectMemberForm onSubmit={addMember} /> : null}

      {mutationError ? (
        <p className="form-alert" role="alert">
          {mutationError}
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
            <ProjectMemberRow
              key={member.user.id}
              member={member}
              canManage={canManage}
              isPending={
                mutations.changeMemberRole.isPending ||
                mutations.removeMember.isPending
              }
              onChangeRole={(role) => void changeMemberRole(member, role)}
              onRequestRemove={() => setMemberToRemove(member)}
            />
          ))}
        </ul>
      ) : null}

      {memberToRemove ? (
        <RemoveProjectMemberDialog
          member={memberToRemove}
          isPending={mutations.removeMember.isPending}
          onCancel={() => setMemberToRemove(undefined)}
          onConfirm={() => void removeMember()}
        />
      ) : null}

      {showLeaveDialog ? (
        <LeaveProjectDialog
          projectName={project.name}
          isPending={mutations.leaveProject.isPending}
          onCancel={() => setShowLeaveDialog(false)}
          onConfirm={() => void leaveProject()}
        />
      ) : null}
    </section>
  );
}
