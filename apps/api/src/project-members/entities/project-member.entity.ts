import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { Project } from '../../projects/entities/project.entity';
import { User } from '../../users/entities/user.entity';
import { ProjectMemberRole } from '../enums/project-member-role.enum';

@Entity({ name: 'project_members' })
@Unique('UQ_project_members_project_user', ['projectId', 'userId'])
@Index('IDX_project_members_project_id', ['projectId'])
@Index('IDX_project_members_user_id', ['userId'])
export class ProjectMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'project_id',
    type: 'uuid',
  })
  projectId: string;

  @ManyToOne(() => Project, (project) => project.members, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'project_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_project_members_project_id',
  })
  project: Project;

  @Column({
    name: 'user_id',
    type: 'uuid',
  })
  userId: string;

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'user_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'FK_project_members_user_id',
  })
  user: User;

  @Column({
    type: 'enum',
    enum: ProjectMemberRole,
    enumName: 'project_member_role_enum',
  })
  role: ProjectMemberRole;

  @Column({
    name: 'joined_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  joinedAt: Date;

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
