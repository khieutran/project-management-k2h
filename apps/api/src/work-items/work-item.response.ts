import { WorkItem } from './work-item.entity';
import { WorkItemPriority, WorkItemStatus, WorkItemType } from './work-item.enums';

export type WorkItemResponse = {
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

export function toWorkItemResponse(item: WorkItem): WorkItemResponse {
  return {
    id: item.id,
    projectId: item.projectId,
    type: item.type,
    title: item.title,
    description: item.description,
    status: item.status,
    priority: item.priority,
    dueDate: item.dueDate,
    assigneeId: item.assigneeId,
    labels: item.labels,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}
