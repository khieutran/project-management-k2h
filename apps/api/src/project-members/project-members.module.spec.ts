import type { DynamicModule, Provider } from '@nestjs/common';
import { GUARDS_METADATA, MODULE_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RefreshSession } from '../refresh-sessions/entities/refresh-session.entity';
import { Project } from '../projects/entities/project.entity';
import { ProjectAccessService } from '../projects/project-access.service';
import { ProjectsModule } from '../projects/projects.module';
import { ProjectsService } from '../projects/projects.service';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { ProjectMember } from './entities/project-member.entity';
import { ProjectMembersController } from './project-members.controller';
import { ProjectMembersModule } from './project-members.module';
import { ProjectMembersService } from './project-members.service';

describe('ProjectMembersModule', () => {
  it('registers its repository, dependencies, controller, and service', () => {
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      ProjectMembersModule,
    ) as Array<DynamicModule | unknown> | undefined;
    const controllers = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      ProjectMembersModule,
    ) as unknown[] | undefined;
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      ProjectMembersModule,
    ) as Provider[] | undefined;
    const typeOrmFeature = imports?.find(
      (moduleImport): moduleImport is DynamicModule =>
        typeof moduleImport === 'object' &&
        moduleImport !== null &&
        'module' in moduleImport &&
        moduleImport.module === TypeOrmModule,
    );

    expect(typeOrmFeature?.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provide: getRepositoryToken(ProjectMember),
        }),
      ]),
    );
    expect(imports).toEqual(
      expect.arrayContaining([AuthModule, ProjectsModule, UsersModule]),
    );
    expect(controllers).toContain(ProjectMembersController);
    expect(providers).toContain(ProjectMembersService);
  });

  it('keeps authentication on the controller without a module cycle', () => {
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      ProjectMembersModule,
    ) as unknown[] | undefined;
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      ProjectMembersController,
    ) as unknown[] | undefined;

    expect(guards).toEqual([JwtAuthGuard]);
    expect(imports).toContain(ProjectsModule);
    expect(imports).not.toContain(ProjectMembersModule);
  });

  it('can be compiled with isolated database and feature dependencies', async () => {
    const repository = {};
    const authService = {};
    const projectsService = {};
    const projectAccessService = {};
    const projectMembersService = {};
    const configValues = {
      JWT_ACCESS_SECRET: 'test-jwt-access-secret-at-least-32-characters',
      JWT_ACCESS_TTL_SECONDS: 900,
      REFRESH_TOKEN_PEPPER: 'test-refresh-token-pepper-at-least-32-characters',
      REFRESH_TOKEN_TTL_SECONDS: 604800,
      AUTH_COOKIE_SECURE: false,
      AUTH_COOKIE_SAME_SITE: 'lax' as const,
    };
    const configService = {
      getOrThrow: jest.fn((key: keyof typeof configValues) => {
        const value = configValues[key];

        if (value === undefined) {
          throw new Error(`Missing test configuration: ${key}`);
        }

        return value;
      }),
    };

    const testingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          { name: 'register', limit: 3, ttl: 3_600_000 },
          { name: 'login', limit: 5, ttl: 60_000 },
          { name: 'refresh', limit: 20, ttl: 60_000 },
        ]),
        ProjectMembersModule,
      ],
    })
      .overrideProvider(getRepositoryToken(ProjectMember))
      .useValue(repository)
      .overrideProvider(getRepositoryToken(Project))
      .useValue(repository)
      .overrideProvider(getRepositoryToken(User))
      .useValue(repository)
      .overrideProvider(getRepositoryToken(RefreshSession))
      .useValue(repository)
      .overrideProvider(ConfigService)
      .useValue(configService)
      .overrideProvider(AuthService)
      .useValue(authService)
      .overrideProvider(ProjectsService)
      .useValue(projectsService)
      .overrideProvider(ProjectAccessService)
      .useValue(projectAccessService)
      .overrideProvider(ProjectMembersService)
      .useValue(projectMembersService)
      .compile();

    expect(testingModule.get(ProjectMembersController)).toBeInstanceOf(
      ProjectMembersController,
    );
    expect(testingModule.get(ProjectMembersService)).toBe(
      projectMembersService,
    );

    await testingModule.close();
  });
});
