import { Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module';
import { RefreshSessionsModule } from '../refresh-sessions/refresh-sessions.module';
import { PasswordService } from './services/password.service';

@Module({
  imports: [UsersModule, RefreshSessionsModule],
  providers: [PasswordService],
})
export class AuthModule {}
