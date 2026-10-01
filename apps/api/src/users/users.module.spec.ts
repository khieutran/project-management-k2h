import { Test } from '@nestjs/testing';
import { UsersModule } from './users.module';

describe('UsersModule', () => {
  it('can be compiled as a Nest feature module', async () => {
    const testingModule = await Test.createTestingModule({
      imports: [UsersModule],
    }).compile();

    expect(testingModule).toBeDefined();

    await testingModule.close();
  });
});
