import { GUARDS_METADATA, MODULE_METADATA } from '@nestjs/common/constants';
import type { DynamicModule, Provider } from '@nestjs/common';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Project } from './entities/project.entity';
import { ProjectsController } from './projects.controller';
import { ProjectsModule } from './projects.module';
import { ProjectsService } from './projects.service';

describe('ProjectsModule', () => {
  it('registers the project repository, controller, and service', () => {
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      ProjectsModule,
    ) as Array<DynamicModule | unknown> | undefined;
    const controllers = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      ProjectsModule,
    ) as unknown[] | undefined;
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      ProjectsModule,
    ) as Provider[] | undefined;

    const typeOrmFeature = imports?.find(
      (moduleImport): moduleImport is DynamicModule =>
        typeof moduleImport === 'object' &&
        moduleImport !== null &&
        'module' in moduleImport &&
        moduleImport.module === TypeOrmModule,
    );

    expect(typeOrmFeature).toBeDefined();
    expect(typeOrmFeature?.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provide: getRepositoryToken(Project),
        }),
      ]),
    );
    expect(imports).toContain(AuthModule);
    expect(controllers).toContain(ProjectsController);
    expect(providers).toContain(ProjectsService);
  });

  it('protects every project endpoint with the JWT auth guard', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      ProjectsController,
    ) as unknown[] | undefined;

    expect(guards).toEqual([JwtAuthGuard]);
  });
});
