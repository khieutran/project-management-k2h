import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';

@Entity({ name: 'refresh_sessions' })
export class RefreshSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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
    foreignKeyConstraintName: 'FK_refresh_sessions_user_id',
  })
  user: User;

  @Index('IDX_refresh_sessions_family_id')
  @Column({
    name: 'family_id',
    type: 'uuid',
  })
  familyId: string;

  @Column({
    name: 'token_digest',
    type: 'varchar',
    unique: true,
  })
  tokenDigest: string;

  @Column({
    name: 'expires_at',
    type: 'timestamptz',
  })
  expiresAt: Date;

  @Column({
    name: 'revoked_at',
    type: 'timestamptz',
    nullable: true,
  })
  revokedAt: Date | null;

  @Column({
    name: 'replaced_by_session_id',
    type: 'uuid',
    nullable: true,
  })
  replacedBySessionId: string | null;

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
