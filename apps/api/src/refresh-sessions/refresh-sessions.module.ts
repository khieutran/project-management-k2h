import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { RefreshSession } from './entities/refresh-session.entity';
import { RefreshSessionsService } from './refresh-sessions.service';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([RefreshSession])],
  providers: [RefreshSessionsService],
  exports: [RefreshSessionsService],
})
export class RefreshSessionsModule {}
