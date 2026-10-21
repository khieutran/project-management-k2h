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

    expect(service.list).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }), 'project-1');
    expect(service.detail).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }), 'project-1', 'item-1');
  });
});
