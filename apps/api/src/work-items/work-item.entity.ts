import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

import { Project } from '../projects/entities/project.entity';
import { User } from '../users/entities/user.entity';
import { WorkItemPriority, WorkItemStatus, WorkItemType } from './work-item.enums';

@Entity({ name: 'work_items' })
export class WorkItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id', foreignKeyConstraintName: 'FK_work_items_project_id' })
  project: Project;

  @Column({ type: 'enum', enum: WorkItemType, enumName: 'work_item_type_enum' })
  type: WorkItemType;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: WorkItemStatus, enumName: 'work_item_status_enum', default: WorkItemStatus.Todo })
  status: WorkItemStatus;

  @Column({ type: 'enum', enum: WorkItemPriority, enumName: 'work_item_priority_enum', default: WorkItemPriority.Medium })
  priority: WorkItemPriority;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: string | null;

  @Column({ name: 'assignee_id', type: 'uuid', nullable: true })
  assigneeId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assignee_id', foreignKeyConstraintName: 'FK_work_items_assignee_id' })
  assignee: User | null;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  labels: string[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
