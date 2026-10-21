import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

import type { EnvironmentVariables } from '../../config/environment.schema';
import { Project } from '../../projects/entities/project.entity';
import { ProjectStatus } from '../../projects/enums/project-status.enum';
import { RefreshSessionsService } from '../../refresh-sessions/refresh-sessions.service';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { toSafeUser } from '../../users/mappers/to-safe-user';
import { WorkItem } from '../../work-items/work-item.entity';
import { WorkItemPriority, WorkItemStatus, WorkItemType } from '../../work-items/work-item.enums';
import { PasswordService } from '../services/password.service';
import { TokenService } from '../services/token.service';
import type { AuthSessionResult } from '../types/auth-session-result.type';

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 100;

@Injectable()
export class DemoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DemoService.name);
  private readonly demoTtlSeconds: number;
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly dataSource: DataSource,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly refreshSessionsService: RefreshSessionsService,
    configService: ConfigService<EnvironmentVariables, true>,
  ) {
    this.demoTtlSeconds = configService.getOrThrow<number>(
      'DEMO_SESSION_TTL_SECONDS',
    );
  }

  onModuleInit(): void {
    void this.cleanupExpired().catch((error: unknown) =>
      this.logger.error('Demo cleanup failed', error),
    );
    this.cleanupTimer = setInterval(() => {
      void this.cleanupExpired().catch((error: unknown) =>
        this.logger.error('Demo cleanup failed', error),
      );
    }, CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  async createSession(): Promise<AuthSessionResult> {
    const demoExpiresAt = new Date(Date.now() + this.demoTtlSeconds * 1000);
    const email = `demo-${randomUUID()}@demo.k2h.invalid`;
    const passwordHash = await this.passwordService.hash(
      randomBytes(32).toString('base64url'),
    );
    const refreshToken = this.tokenService.generateRefreshToken();
    const tokenDigest = this.tokenService.digestRefreshToken(refreshToken);

    const response = await this.dataSource.transaction(async (manager) => {
      const user = await manager.getRepository(User).save(
        manager.getRepository(User).create({
          email,
          passwordHash,
          displayName: 'Khách trải nghiệm',
          role: UserRole.User,
          demoExpiresAt,
        }),
      );

      const projects = await manager.getRepository(Project).save(
        [
          {
            key: this.projectKey(),
            name: 'Website sản phẩm',
            description:
              'Theo dõi tiến độ xây dựng website và chuẩn bị bản phát hành.',
            ownerId: user.id,
            status: ProjectStatus.Active,
            startDate: null,
            endDate: null,
            archivedAt: null,
            deletedAt: null,
          },
          {
            key: this.projectKey(),
            name: 'Ứng dụng di động',
            description:
              'Lập kế hoạch tính năng và phân chia công việc cho phiên bản đầu tiên.',
            ownerId: user.id,
            status: ProjectStatus.Planning,
            startDate: null,
            endDate: null,
            archivedAt: null,
            deletedAt: null,
          },
          {
            key: this.projectKey(),
            name: 'Trang giới thiệu K2H',
            description:
              'Dự án mẫu đã hoàn thành để thử bộ lọc và vòng đời dự án.',
            ownerId: user.id,
            status: ProjectStatus.Completed,
            startDate: null,
            endDate: null,
            archivedAt: null,
            deletedAt: null,
          },
        ].map((input) => manager.getRepository(Project).create(input)),
      );
      const [websiteProject, mobileProject, introProject] = projects;
      if (!websiteProject || !mobileProject || !introProject) {
        throw new Error('Failed to seed demo projects');
      }

      const workItems = manager.getRepository(WorkItem);
      await workItems.save(
        [
          {
            projectId: websiteProject.id, type: WorkItemType.Task, title: 'Thiết kế trang sản phẩm',
            description: 'Hoàn thiện bố cục và các thành phần chính của trang sản phẩm.',
            status: WorkItemStatus.InProgress, priority: WorkItemPriority.High, labels: ['giao diện'],
          },
          {
            projectId: websiteProject.id, type: WorkItemType.Bug, title: 'Sửa nút đăng nhập trên mobile',
            description: 'Nút đăng nhập chưa phản hồi ổn định trên màn hình nhỏ.',
            status: WorkItemStatus.Todo, priority: WorkItemPriority.Medium, labels: ['mobile'],
          },
          {
            projectId: websiteProject.id, type: WorkItemType.Test, title: 'Kiểm thử luồng đăng ký',
            description: 'Kiểm tra tạo tài khoản, thông báo lỗi và xác nhận đăng nhập.',
            status: WorkItemStatus.Review, priority: WorkItemPriority.Medium, labels: ['kiểm thử'],
          },
          {
            projectId: mobileProject.id, type: WorkItemType.Task, title: 'Lên luồng onboarding',
            description: 'Phác thảo các bước giới thiệu ứng dụng cho người dùng mới.',
            status: WorkItemStatus.Todo, priority: WorkItemPriority.High, labels: ['trải nghiệm'],
          },
          {
            projectId: mobileProject.id, type: WorkItemType.Test, title: 'Kiểm thử thông báo đẩy',
            description: 'Xác nhận thông báo hiển thị đúng trong các trạng thái ứng dụng.',
            status: WorkItemStatus.Todo, priority: WorkItemPriority.Low, labels: ['kiểm thử'],
          },
          {
            projectId: introProject.id, type: WorkItemType.Task, title: 'Hoàn thiện nội dung giới thiệu',
            description: 'Rà soát nội dung và hình ảnh trước khi bàn giao.',
            status: WorkItemStatus.Done, priority: WorkItemPriority.Medium, labels: ['nội dung'],
          },
        ].map((input) => workItems.create(input)),
      );

      const session = await this.refreshSessionsService.createInitialSession(
        { userId: user.id, tokenDigest },
        manager,
      );
      const accessToken = await this.tokenService.issueAccessToken({
        userId: user.id,
        sessionId: session.id,
        role: user.role,
        expiresAt: demoExpiresAt,
      });

      return {
        user: toSafeUser(user),
        accessToken,
        accessTokenExpiresIn: Math.min(
          this.tokenService.getAccessTokenExpiresInSeconds(),
          this.demoTtlSeconds,
        ),
      };
    });

    return { response, refreshToken };
  }

  async cleanupExpired(): Promise<number> {
    let removed = 0;
    while (true) {
      const count = await this.dataSource.transaction(async (manager) => {
        const rows = (await manager.query(
          'SELECT id FROM users WHERE demo_expires_at <= NOW() ORDER BY demo_expires_at LIMIT $1 FOR UPDATE SKIP LOCKED',
          [CLEANUP_BATCH_SIZE],
        )) as Array<{ id: string }>;
        const ids = rows.map((row) => row.id);
        if (ids.length === 0) return 0;
        await manager.query(
          'DELETE FROM projects WHERE owner_id = ANY($1::uuid[])',
          [ids],
        );
        await manager.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [
          ids,
        ]);
        return ids.length;
      });
      removed += count;
      if (count < CLEANUP_BATCH_SIZE) return removed;
    }
  }

  private projectKey(): string {
    return randomBytes(5).toString('hex').toUpperCase();
  }
}
