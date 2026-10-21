export type WorkItemType = 'TASK' | 'BUG' | 'TEST';
export type WorkItemStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
export type WorkItemPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export type WorkItem = {
  id: string;
  projectId: string;
  type: WorkItemType;
  title: string;
  description: string | null;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  dueDate: string | null;
  assigneeId: string | null;
  labels: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreateWorkItemInput = { type: WorkItemType; title: string; description?: string | null };
export type UpdateWorkItemInput = Partial<Pick<WorkItem, 'title' | 'description' | 'status' | 'priority' | 'dueDate' | 'labels'>>;
