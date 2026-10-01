import { Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module';
import { RefreshSessionsModule } from '../refresh-sessions/refresh-sessions.module';

@Module({
  imports: [UsersModule, RefreshSessionsModule],
})
export class AuthModule {}
