import { useEffect, useRef, useState, type FormEvent } from 'react';

import type { WorkItem, WorkItemPriority, WorkItemStatus } from './work-item.types';
import { useWorkItem, useWorkItemMutations } from './use-work-items';

const STATUS_LABELS: Record<WorkItemStatus, string> = {
  TODO: 'Cần làm', IN_PROGRESS: 'Đang làm', REVIEW: 'Đang duyệt', DONE: 'Hoàn thành',
};
const PRIORITY_LABELS: Record<WorkItemPriority, string> = { LOW: 'Thấp', MEDIUM: 'Vừa', HIGH: 'Cao' };

type WorkItemDetailProps = {
  projectId: string;
  itemId: string;
  canWrite: boolean;
  includeDeleted?: boolean;
  onClose: () => void;
};

function formatDate(date: string | null): string {
  if (!date) return 'Chưa đặt';
  const [year, month, day] = date.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

export function WorkItemDetail({ projectId, itemId, canWrite, includeDeleted = false, onClose }: WorkItemDetailProps) {
  const itemQuery = useWorkItem(projectId, itemId, includeDeleted);
  const mutations = useWorkItemMutations(projectId);
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus();
    return () => previousFocus?.focus();
  }, []);

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    } else if (event.key === 'Tab' && dialog.current) {
      const controls = Array.from(dialog.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]'));
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  }

  return (
    <div className="work-item-detail-backdrop" onKeyDown={handleKeyDown}>
      <section className="work-item-detail-dialog" ref={dialog} role="dialog" aria-modal="true" aria-label={itemQuery.data ? `Chi tiết ${itemQuery.data.title}` : 'Chi tiết công việc'}>
        <button className="work-item-detail-close" type="button" ref={closeButton} onClick={onClose} aria-label="Đóng chi tiết">×</button>
        {itemQuery.isPending ? <p role="status">Đang tải công việc...</p> : null}
        {itemQuery.isError ? <div className="work-item-detail-error" role="alert"><p>Không thể tải công việc.</p><button type="button" onClick={onClose}>Quay lại dự án</button></div> : null}
        {itemQuery.data ? <DetailContent item={itemQuery.data} canWrite={canWrite} onSave={(input) => mutations.update.mutateAsync({ itemId, input })} isSaving={mutations.update.isPending} /> : null}
      </section>
    </div>
  );
}

type UpdateInput = { title: string; description: string | null; status: WorkItemStatus; priority: WorkItemPriority; dueDate: string | null };

function DetailContent({ item, canWrite, onSave, isSaving }: {
  item: WorkItem;
  canWrite: boolean;
  onSave: (input: UpdateInput) => Promise<unknown>;
  isSaving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description ?? '');
  const [status, setStatus] = useState(item.status);
  const [priority, setPriority] = useState(item.priority);
  const [dueDate, setDueDate] = useState(item.dueDate ?? '');
  const [error, setError] = useState('');

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    try {
      await onSave({ title: title.trim(), description: description.trim() || null, status, priority, dueDate: dueDate || null });
      setEditing(false);
    } catch {
      setError('Không thể lưu thay đổi. Vui lòng thử lại.');
    }
  }

  return (
    <>
      <header className="work-item-detail-header">
        <p>Mã kiện hàng · {item.type}-{item.id.slice(0, 6).toUpperCase()}</p>
        <h2>{item.title}</h2>
        <div className="work-item-detail-badges"><span>{item.type}</span><span>{STATUS_LABELS[item.status]}</span></div>
      </header>
      <div className="work-item-detail-body">
        <div className="work-item-detail-main">
          {editing ? (
            <form className="work-item-detail-form" onSubmit={(event) => void save(event)}>
              <label>Tên công việc<input required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
              <label>Mô tả<textarea maxLength={5000} rows={7} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
              <div className="work-item-detail-form-grid">
                <label>Trạng thái<select value={status} onChange={(event) => setStatus(event.target.value as WorkItemStatus)}>{Object.entries(STATUS_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                <label>Ưu tiên<select value={priority} onChange={(event) => setPriority(event.target.value as WorkItemPriority)}>{Object.entries(PRIORITY_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                <label>Hạn hoàn thành<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
              </div>
              {error ? <p role="alert">{error}</p> : null}
              <div className="work-item-detail-actions"><button type="button" onClick={() => setEditing(false)}>Hủy</button><button type="submit" disabled={isSaving}>Lưu thay đổi</button></div>
            </form>
          ) : (
            <>
              <div className="work-item-detail-section-title"><h3>Mô tả</h3>{canWrite ? <button type="button" onClick={() => setEditing(true)}>Chỉnh sửa</button> : null}</div>
              <p className="work-item-detail-description">{item.description || 'Chưa có mô tả.'}</p>
            </>
          )}
        </div>
        <aside className="work-item-detail-properties" aria-label="Thuộc tính công việc">
          <h3>Thuộc tính</h3>
          <dl>
            <div><dt>Loại</dt><dd>{item.type}</dd></div>
            <div><dt>Trạng thái</dt><dd>{STATUS_LABELS[item.status]}</dd></div>
            <div><dt>Ưu tiên</dt><dd>{PRIORITY_LABELS[item.priority]}</dd></div>
            <div><dt>Hạn hoàn thành</dt><dd>{formatDate(item.dueDate)}</dd></div>
            <div><dt>Người phụ trách</dt><dd>{item.assigneeId ? 'Đã phân công' : 'Chưa phân công'}</dd></div>
            <div><dt>Nhãn</dt><dd>{item.labels.length ? item.labels.join(', ') : 'Chưa có'}</dd></div>
          </dl>
        </aside>
      </div>
    </>
  );
}
