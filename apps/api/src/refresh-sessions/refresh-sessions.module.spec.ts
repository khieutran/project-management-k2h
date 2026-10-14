import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

import { RefreshSession } from './entities/refresh-session.entity';
import { RefreshSessionsModule } from './refresh-sessions.module';
import { RefreshSessionsService } from './refresh-sessions.service';

describe('RefreshSessionsModule', () => {
  it('provides the RefreshSession repository', async () => {
    const refreshSessionRepository = {};
    const configService = {
      getOrThrow: jest.fn().mockReturnValue(604800),
    };

    const testingModule = await Test.createTestingModule({
      imports: [RefreshSessionsModule],
    })
      .overrideProvider(getRepositoryToken(RefreshSession))
      .useValue(refreshSessionRepository)
      .overrideProvider(ConfigService)
      .useValue(configService)
      .compile();

    expect(testingModule.get(getRepositoryToken(RefreshSession))).toBe(
      refreshSessionRepository,
    );

    expect(testingModule.get(RefreshSessionsService)).toBeInstanceOf(
      RefreshSessionsService,
    );

    await testingModule.close();
  });
});
