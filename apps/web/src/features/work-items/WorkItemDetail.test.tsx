import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { useWorkItem, useWorkItemMutations } from './use-work-items';
import { WorkItemDetail } from './WorkItemDetail';

vi.mock('./use-work-items', () => ({ useWorkItem: vi.fn(), useWorkItemMutations: vi.fn() }));

describe('WorkItemDetail', () => {
  it('shows persisted details and closes on Escape', async () => {
    const onClose = vi.fn();
    vi.mocked(useWorkItem).mockReturnValue({ data: {
      id: 'item-1', projectId: 'project-1', type: 'TASK', title: 'Thiết kế hệ thống',
      description: 'Thiết kế bộ thành phần giao diện.', status: 'IN_PROGRESS',
      priority: 'HIGH', dueDate: '2026-11-15', assigneeId: null, labels: ['design'],
      createdAt: '2026-10-19', updatedAt: '2026-10-19',
    }, isPending: false, isError: false } as unknown as ReturnType<typeof useWorkItem>);
    vi.mocked(useWorkItemMutations).mockReturnValue({ update: { mutateAsync: vi.fn(), isPending: false } } as unknown as ReturnType<typeof useWorkItemMutations>);

    render(<WorkItemDetail projectId="project-1" itemId="item-1" canWrite onClose={onClose} />);

    expect(screen.getByRole('dialog', { name: 'Chi tiết Thiết kế hệ thống' })).toBeInTheDocument();
    expect(screen.getByText('Thiết kế bộ thành phần giao diện.')).toBeInTheDocument();
    expect(screen.getByText('15/11/2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đóng chi tiết' })).toHaveFocus();
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(screen.getByRole('button', { name: 'Chỉnh sửa' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Đóng chi tiết' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });
});
