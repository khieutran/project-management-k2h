import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request.type';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { ChangeProjectMemberRoleDto } from './dto/change-project-member-role.dto';
import { ProjectMembersService } from './project-members.service';
import type { ProjectMemberResponse } from './types/project-member-response.type';

@ApiTags('project-members')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/members')
export class ProjectMembersController {
  constructor(private readonly projectMembersService: ProjectMembersService) {}

  @Get()
  @ApiOperation({ summary: 'List members visible in a project' })
  @ApiOkResponse({ description: 'Project owner and members were returned' })
  @ApiNotFoundResponse({ description: 'Project was not found in read scope' })
  @ApiUnauthorizedResponse({
    description: 'Access token is invalid or expired',
  })
  findAll(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ): Promise<{ data: ProjectMemberResponse[] }> {
    return this.projectMembersService.findAll(request.user, projectId);
  }

  @Post()
  @ApiOperation({ summary: 'Add a registered user to an owned project' })
  @ApiCreatedResponse({ description: 'Project member was added' })
  @ApiBadRequestResponse({ description: 'Member input is invalid' })
  @ApiConflictResponse({
    description: 'Membership already exists or project is locked',
  })
  @ApiNotFoundResponse({
    description: 'Owned project or registered user was not found',
  })
  add(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Body() input: AddProjectMemberDto,
  ): Promise<ProjectMemberResponse> {
    return this.projectMembersService.add(request.user, projectId, input);
  }

  @Patch(':userId')
  @ApiOperation({ summary: 'Change a member role in an owned project' })
  @ApiOkResponse({ description: 'Project member role was changed' })
  @ApiBadRequestResponse({ description: 'Member role is invalid' })
  @ApiConflictResponse({ description: 'Project membership is locked' })
  @ApiNotFoundResponse({
    description: 'Owned project or project member was not found',
  })
  changeRole(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() input: ChangeProjectMemberRoleDto,
  ): Promise<ProjectMemberResponse> {
    return this.projectMembersService.changeRole(
      request.user,
      projectId,
      userId,
      input,
    );
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Leave a project as the current member' })
  @ApiNoContentResponse({ description: 'Current member left the project' })
  @ApiBadRequestResponse({ description: 'Project owner cannot leave' })
  @ApiConflictResponse({ description: 'Project membership is locked' })
  @ApiNotFoundResponse({
    description: 'Project or current membership was not found',
  })
  leave(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ): Promise<void> {
    return this.projectMembersService.leave(request.user, projectId);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a member from an owned project' })
  @ApiNoContentResponse({ description: 'Project member was removed' })
  @ApiConflictResponse({ description: 'Project membership is locked' })
  @ApiNotFoundResponse({
    description: 'Owned project or project member was not found',
  })
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
  ): Promise<void> {
    return this.projectMembersService.remove(request.user, projectId, userId);
  }
}
