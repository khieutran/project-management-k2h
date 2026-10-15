import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { UsersModule } from '../users/users.module';
import { ProjectMember } from './entities/project-member.entity';
import { ProjectMembersController } from './project-members.controller';
import { ProjectMembersService } from './project-members.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectMember]),
    AuthModule,
    ProjectsModule,
    UsersModule,
  ],
  controllers: [ProjectMembersController],
  providers: [ProjectMembersService],
})
export class ProjectMembersModule {}
