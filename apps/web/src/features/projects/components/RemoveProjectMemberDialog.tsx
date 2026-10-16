import type { ProjectMember } from '../project.types';

type RemoveProjectMemberDialogProps = {
  member: ProjectMember;
  isPending: boolean;
  onCancel(): void;
  onConfirm(): void;
};

export function RemoveProjectMemberDialog({
  member,
  isPending,
  onCancel,
  onConfirm,
}: RemoveProjectMemberDialogProps) {
  return (
    <div className="dialog-backdrop">
      <section
        className="delete-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-member-title"
      >
        <h2 id="remove-member-title">
          Xóa {member.user.displayName} khỏi dự án?
        </h2>
        <p>
          Thành viên sẽ mất quyền truy cập dự án ngay sau khi bị xóa.
        </p>
        <div className="dialog-actions">
          <button
            className="secondary-button"
            type="button"
            disabled={isPending}
            onClick={onCancel}
          >
            Hủy
          </button>
          <button
            className="danger-button"
            type="button"
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending ? 'Đang xóa...' : 'Xóa thành viên'}
          </button>
        </div>
      </section>
    </div>
  );
}
