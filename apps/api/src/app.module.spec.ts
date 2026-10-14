import { MODULE_METADATA } from '@nestjs/common/constants';

import { AuthModule } from './auth/auth.module';
import { AppModule } from './app.module';
import { ProjectsModule } from './projects/projects.module';

describe('AppModule', () => {
  it('registers the authentication feature', () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) as
      unknown[] | undefined;

    expect(imports).toContain(AuthModule);
  });

  it('registers the project management feature', () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) as
      unknown[] | undefined;

    expect(imports).toContain(ProjectsModule);
  });
});
