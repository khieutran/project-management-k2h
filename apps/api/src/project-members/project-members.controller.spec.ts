import { HttpStatus, ParseUUIDPipe } from '@nestjs/common';
import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  ROUTE_ARGS_METADATA,
} from '@nestjs/common/constants';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request.type';
import { UserRole } from '../users/enums/user-role.enum';
import type { AddProjectMemberDto } from './dto/add-project-member.dto';
import type { ChangeProjectMemberRoleDto } from './dto/change-project-member-role.dto';
import { ProjectMemberRole } from './enums/project-member-role.enum';
import { ProjectMembersController } from './project-members.controller';
import type { ProjectMembersService } from './project-members.service';

describe('ProjectMembersController', () => {
  const projectId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';
  const request = {
    user: {
      userId: '33333333-3333-4333-8333-333333333333',
      sessionId: '99999999-9999-4999-8999-999999999999',
      role: UserRole.User,
    },
  } as AuthenticatedRequest;

  let projectMembersService: {
    findAll: jest.Mock;
    add: jest.Mock;
    changeRole: jest.Mock;
    leave: jest.Mock;
    remove: jest.Mock;
  };
  let controller: ProjectMembersController;

  beforeEach(() => {
    projectMembersService = {
      findAll: jest.fn(),
      add: jest.fn(),
      changeRole: jest.fn(),
      leave: jest.fn(),
      remove: jest.fn(),
    };
    controller = new ProjectMembersController(
      projectMembersService as unknown as ProjectMembersService,
    );
  });

  it('lists members using the authenticated project read scope', async () => {
    const response = { data: [] };
    projectMembersService.findAll.mockResolvedValue(response);

    await expect(controller.findAll(request, projectId)).resolves.toBe(
      response,
    );
    expect(projectMembersService.findAll).toHaveBeenCalledWith(
      request.user,
      projectId,
    );
  });

  it('adds a member using the authenticated owner scope', async () => {
    const input: AddProjectMemberDto = {
      email: 'member@example.com',
      role: ProjectMemberRole.Member,
    };
    const response = {
      user: {
        id: userId,
        email: input.email,
        displayName: 'Project Member',
      },
      role: input.role,
      joinedAt: '2026-10-16T08:00:00.000Z',
    };
    projectMembersService.add.mockResolvedValue(response);

    await expect(controller.add(request, projectId, input)).resolves.toBe(
      response,
    );
    expect(projectMembersService.add).toHaveBeenCalledWith(
      request.user,
      projectId,
      input,
    );
  });

  it('changes a member role using the authenticated owner scope', async () => {
    const input: ChangeProjectMemberRoleDto = {
      role: ProjectMemberRole.Manager,
    };
    projectMembersService.changeRole.mockResolvedValue({ role: input.role });

    await controller.changeRole(request, projectId, userId, input);

    expect(projectMembersService.changeRole).toHaveBeenCalledWith(
      request.user,
      projectId,
      userId,
      input,
    );
  });

  it('returns no body when the current member leaves', async () => {
    projectMembersService.leave.mockResolvedValue(undefined);

    await expect(controller.leave(request, projectId)).resolves.toBeUndefined();
    expect(projectMembersService.leave).toHaveBeenCalledWith(
      request.user,
      projectId,
    );
  });

  it('returns no body when the owner removes a member', async () => {
    projectMembersService.remove.mockResolvedValue(undefined);

    await expect(
      controller.remove(request, projectId, userId),
    ).resolves.toBeUndefined();
    expect(projectMembersService.remove).toHaveBeenCalledWith(
      request.user,
      projectId,
      userId,
    );
  });

  it('protects every member endpoint with JWT authentication', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ProjectMembersController),
    ).toEqual([JwtAuthGuard]);
  });

  it.each(['leave', 'remove'] as const)(
    'uses HTTP 204 for %s',
    (methodName) => {
      expect(
        Reflect.getMetadata(HTTP_CODE_METADATA, controller[methodName]),
      ).toBe(HttpStatus.NO_CONTENT);
    },
  );

  it.each([
    ['findAll', ['projectId']],
    ['add', ['projectId']],
    ['changeRole', ['projectId', 'userId']],
    ['leave', ['projectId']],
    ['remove', ['projectId', 'userId']],
  ] as const)('parses UUID route parameters for %s', (methodName, parameters) => {
    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      ProjectMembersController,
      methodName,
    ) as
      | Record<
          string,
          { data?: string; pipes?: unknown[] }
        >
      | undefined;

    for (const parameter of parameters) {
      const routeParameter = Object.values(metadata ?? {}).find(
        ({ data }) => data === parameter,
      );

      expect(routeParameter?.pipes).toEqual(
        expect.arrayContaining([expect.any(ParseUUIDPipe)]),
      );
    }
  });
});
