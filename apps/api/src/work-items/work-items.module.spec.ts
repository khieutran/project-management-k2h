import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AuthService } from '../auth/auth.service';
import { DemoService } from '../auth/demo/demo.service';
import { RefreshSession } from '../refresh-sessions/entities/refresh-session.entity';
import { ProjectMember } from '../project-members/entities/project-member.entity';
import { Project } from '../projects/entities/project.entity';
import { ProjectAccessService } from '../projects/project-access.service';
import { ProjectsService } from '../projects/projects.service';
import { User } from '../users/entities/user.entity';
import { WorkItem } from './work-item.entity';
import { WorkItemsController } from './work-items.controller';
import { WorkItemsModule } from './work-items.module';

describe('WorkItemsModule', () => {
  it('resolves the authentication guard used by its controller', async () => {
    const repository = {};
    const configValues = {
      JWT_ACCESS_SECRET: 'test-jwt-access-secret-at-least-32-characters',
      JWT_ACCESS_TTL_SECONDS: 900,
      REFRESH_TOKEN_PEPPER: 'test-refresh-token-pepper-at-least-32-characters',
      REFRESH_TOKEN_TTL_SECONDS: 604800,
      AUTH_COOKIE_SECURE: false,
      AUTH_COOKIE_SAME_SITE: 'lax' as const,
    };
    const configService = {
      getOrThrow: jest.fn((key: keyof typeof configValues) => configValues[key]),
    };

    const testingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          { name: 'register', limit: 3, ttl: 3_600_000 },
          { name: 'login', limit: 5, ttl: 60_000 },
          { name: 'refresh', limit: 20, ttl: 60_000 },
        ]),
        WorkItemsModule,
      ],
    })
      .overrideProvider(getRepositoryToken(WorkItem)).useValue(repository)
      .overrideProvider(getRepositoryToken(Project)).useValue(repository)
      .overrideProvider(getRepositoryToken(ProjectMember)).useValue(repository)
      .overrideProvider(getRepositoryToken(User)).useValue(repository)
      .overrideProvider(getRepositoryToken(RefreshSession)).useValue(repository)
      .overrideProvider(ConfigService).useValue(configService)
      .overrideProvider(AuthService).useValue({})
      .overrideProvider(DemoService).useValue({})
      .overrideProvider(ProjectsService).useValue({})
      .overrideProvider(ProjectAccessService).useValue({})
      .compile();

    expect(testingModule.get(WorkItemsController)).toBeInstanceOf(WorkItemsController);
    await testingModule.close();
  });
});
