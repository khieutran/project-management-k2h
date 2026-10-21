import { WorkItemsController } from './work-items.controller';

describe('WorkItemsController', () => {
  it('forwards the project and item IDs from nested routes', async () => {
    const service = {
      list: jest.fn().mockResolvedValue([]),
      detail: jest.fn().mockResolvedValue({ id: 'item-1' }),
    };
    const controller = new WorkItemsController(service as never);
    const request = { user: { userId: 'user-1' } } as never;

    await controller.list(request, 'project-1');
    await controller.detail(request, 'project-1', 'item-1');

    expect(service.list).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }), 'project-1', false);
    expect(service.detail).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }), 'project-1', 'item-1', false);
  });

  it('forwards the deleted-view option on read routes', async () => {
    const service = {
      list: jest.fn().mockResolvedValue([]),
      detail: jest.fn().mockResolvedValue({ id: 'item-1' }),
    };
    const controller = new WorkItemsController(service as never);
    const principal = { userId: 'admin-1' };
    const request = { user: principal } as never;

    await Reflect.apply(controller.list, controller, [request, 'project-1', true]);
    await Reflect.apply(controller.detail, controller, [request, 'project-1', 'item-1', true]);

    expect(service.list).toHaveBeenCalledWith(principal, 'project-1', true);
    expect(service.detail).toHaveBeenCalledWith(principal, 'project-1', 'item-1', true);
  });
});
