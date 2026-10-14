import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
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
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request.type';
import { CreateProjectDto } from './dto/create-project.dto';
import { ChangeProjectStatusDto } from './dto/change-project-status.dto';
import { ListProjectsQueryDto } from './dto/list-projects-query.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
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

  @Get(':projectId')
  @ApiOperation({ summary: 'Get a project visible to the current user' })
  @ApiQuery({
    name: 'includeDeleted',
    required: false,
    type: Boolean,
    description: 'ADMIN-only option for reading soft-deleted projects',
  })
  @ApiOkResponse({ description: 'Project detail was returned' })
  @ApiForbiddenResponse({
    description: 'Including deleted projects requires ADMIN role',
  })
  @ApiNotFoundResponse({ description: 'Project was not found in read scope' })
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Query('includeDeleted', new DefaultValuePipe(false), ParseBoolPipe)
    includeDeleted: boolean,
  ): Promise<ProjectResponse> {
    return this.projectsService.findOne(request.user, projectId, {
      includeDeleted,
    });
  }

  @Patch(':projectId')
  @ApiOperation({ summary: 'Update an owned project' })
  @ApiOkResponse({ description: 'Project information was updated' })
  @ApiBadRequestResponse({ description: 'Project update is invalid' })
  @ApiConflictResponse({ description: 'Project state or dates conflict' })
  @ApiNotFoundResponse({ description: 'Owned project was not found' })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Body() input: UpdateProjectDto,
  ): Promise<ProjectResponse> {
    return this.projectsService.update(request.user, projectId, input);
  }

  @Patch(':projectId/status')
  @ApiOperation({ summary: 'Change an owned project lifecycle status' })
  @ApiOkResponse({ description: 'Project lifecycle status was changed' })
  @ApiConflictResponse({ description: 'Lifecycle transition is not allowed' })
  @ApiNotFoundResponse({ description: 'Owned project was not found' })
  changeStatus(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Body() input: ChangeProjectStatusDto,
  ): Promise<ProjectResponse> {
    return this.projectsService.changeStatus(request.user, projectId, input);
  }

  @Post(':projectId/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive an owned project' })
  @ApiOkResponse({ description: 'Project is archived' })
  @ApiNotFoundResponse({ description: 'Owned project was not found' })
  archive(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ): Promise<ProjectResponse> {
    return this.projectsService.archive(request.user, projectId);
  }

  @Post(':projectId/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore an owned archived project' })
  @ApiOkResponse({ description: 'Project is restored' })
  @ApiNotFoundResponse({ description: 'Owned project was not found' })
  restore(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ): Promise<ProjectResponse> {
    return this.projectsService.restore(request.user, projectId);
  }

  @Delete(':projectId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete an owned project' })
  @ApiNoContentResponse({ description: 'Project was deleted' })
  @ApiNotFoundResponse({ description: 'Owned project was not found' })
  delete(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ): Promise<void> {
    return this.projectsService.delete(request.user, projectId);
  }
}
