import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { RefreshSession } from './entities/refresh-session.entity';
import { RefreshSessionsModule } from './refresh-sessions.module';

describe('RefreshSessionsModule', () => {
  it('provides the RefreshSession repository', async () => {
    const refreshSessionRepository = {};

    const testingModule = await Test.createTestingModule({
      imports: [RefreshSessionsModule],
    })
      .overrideProvider(getRepositoryToken(RefreshSession))
      .useValue(refreshSessionRepository)
      .compile();

    expect(testingModule.get(getRepositoryToken(RefreshSession))).toBe(
      refreshSessionRepository,
    );

    await testingModule.close();
  });
});
