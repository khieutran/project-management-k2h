import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ProjectMember } from '../../project-members/entities/project-member.entity';
import { User } from '../../users/entities/user.entity';
import { ProjectStatus } from '../enums/project-status.enum';

@Entity({ name: 'projects' })
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 10,
    unique: true,
  })
  key: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  name: string;

  @Column({
    type: 'varchar',
    length: 2000,
    nullable: true,
  })
  description: string | null;

  @Column({
    name: 'owner_id',
    type: 'uuid',
  })
  ownerId: string;

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'owner_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_projects_owner_id',
  })
  owner: User;

  @OneToMany(() => ProjectMember, (membership) => membership.project)
  members: ProjectMember[];

  @Column({
    type: 'enum',
    enum: ProjectStatus,
    enumName: 'project_status_enum',
    default: ProjectStatus.Planning,
  })
  status: ProjectStatus;

  @Column({
    name: 'start_date',
    type: 'date',
    nullable: true,
  })
  startDate: string | null;

  @Column({
    name: 'end_date',
    type: 'date',
    nullable: true,
  })
  endDate: string | null;

  @Column({
    name: 'archived_at',
    type: 'timestamptz',
    nullable: true,
  })
  archivedAt: Date | null;

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamptz',
    nullable: true,
  })
  deletedAt: Date | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
  })
  updatedAt: Date;
}
