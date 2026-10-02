import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RefreshSession } from './entities/refresh-session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RefreshSession])],
})
export class RefreshSessionsModule {}
