import { Test } from '@nestjs/testing';
import { RefreshSessionsModule } from './refresh-sessions.module';

describe('RefreshSessionsModule', () => {
  it('can be compiled as a Nest feature module', async () => {
    const testingModule = await Test.createTestingModule({
      imports: [RefreshSessionsModule],
    }).compile();

    expect(testingModule).toBeDefined();

    await testingModule.close();
  });
});
