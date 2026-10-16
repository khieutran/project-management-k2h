type LeaveProjectDialogProps = {
  projectName: string;
  isPending: boolean;
  onCancel(): void;
  onConfirm(): void;
};

export function LeaveProjectDialog({
  projectName,
  isPending,
  onCancel,
  onConfirm,
}: LeaveProjectDialogProps) {
  return (
    <div className="dialog-backdrop">
      <section
        className="delete-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-project-title"
      >
        <h2 id="leave-project-title">Rời dự án {projectName}?</h2>
        <p>
          Bạn sẽ mất quyền truy cập dự án ngay sau khi rời. Chủ dự án có
          thể thêm bạn trở lại sau.
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
            {isPending ? 'Đang rời dự án...' : 'Xác nhận rời dự án'}
          </button>
        </div>
      </section>
    </div>
  );
}
