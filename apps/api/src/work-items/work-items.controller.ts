import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param,
  ParseUUIDPipe, Patch, Post, Req, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request.type';
import { CreateWorkItemDto, UpdateWorkItemDto } from './work-item.dto';
import type { WorkItemResponse } from './work-item.response';
import { WorkItemsService } from './work-items.service';

@ApiTags('work-items')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/work-items')
export class WorkItemsController {
  constructor(private readonly service: WorkItemsService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ): Promise<WorkItemResponse[]> {
    return this.service.list(request.user, projectId);
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Body() input: CreateWorkItemDto,
  ): Promise<WorkItemResponse> {
    return this.service.create(request.user, projectId, input);
  }

  @Get(':itemId')
  detail(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
  ): Promise<WorkItemResponse> {
    return this.service.detail(request.user, projectId, itemId);
  }

  @Patch(':itemId')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @Body() input: UpdateWorkItemDto,
  ): Promise<WorkItemResponse> {
    return this.service.update(request.user, projectId, itemId, input);
  }

  @Delete(':itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
  ): Promise<void> {
    return this.service.remove(request.user, projectId, itemId);
  }
}
