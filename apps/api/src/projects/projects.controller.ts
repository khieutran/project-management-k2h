import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request.type';
import { CreateProjectDto } from './dto/create-project.dto';
import { ListProjectsQueryDto } from './dto/list-projects-query.dto';
import { ProjectsService } from './projects.service';
import type { PaginatedProjects } from './types/paginated-projects.type';
import type { ProjectResponse } from './types/project-response.type';

@ApiTags('projects')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a project owned by the current user' })
  @ApiCreatedResponse({ description: 'Project was created' })
  @ApiBadRequestResponse({ description: 'Project input is invalid' })
  @ApiConflictResponse({ description: 'Project key already exists' })
  @ApiUnauthorizedResponse({
    description: 'Access token is invalid or expired',
  })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateProjectDto,
  ): Promise<ProjectResponse> {
    return this.projectsService.create(request.user, input);
  }

  @Get()
  @ApiOperation({ summary: 'List projects visible to the current user' })
  @ApiOkResponse({ description: 'Paginated projects were returned' })
  @ApiBadRequestResponse({ description: 'Project query is invalid' })
  @ApiForbiddenResponse({ description: 'Deleted view requires ADMIN role' })
  @ApiUnauthorizedResponse({
    description: 'Access token is invalid or expired',
  })
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListProjectsQueryDto,
  ): Promise<PaginatedProjects> {
    return this.projectsService.findAll(request.user, query);
  }
}
