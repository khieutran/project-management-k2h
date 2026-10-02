import { MODULE_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AuthModule } from './auth.module';
import { RefreshSessionsModule } from '../refresh-sessions/refresh-sessions.module';
import { UsersModule } from '../users/users.module';
import { User } from '../users/entities/user.entity';

describe('AuthModule', () => {
  it('imports the user and refresh-session modules', async () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AuthModule) as
      unknown[] | undefined;

    expect(imports).toEqual(
      expect.arrayContaining([UsersModule, RefreshSessionsModule]),
    );
  });

  it('can be compiled as a Nest feature module', async () => {
    const userRepository = {};

    const testingModule = await Test.createTestingModule({
      imports: [AuthModule],
    })
      .overrideProvider(getRepositoryToken(User))
      .useValue(userRepository)
      .compile();

    expect(testingModule).toBeDefined();

    await testingModule.close();
  });
});
