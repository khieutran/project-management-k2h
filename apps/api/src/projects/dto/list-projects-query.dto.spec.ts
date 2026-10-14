import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ProjectStatus } from '../enums/project-status.enum';
import {
  ListProjectsQueryDto,
  ProjectListView,
} from './list-projects-query.dto';

describe('ListProjectsQueryDto', () => {
  it('applies pagination and view defaults', async () => {
    const dto = plainToInstance(ListProjectsQueryDto, {});

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({
      page: 1,
      limit: 20,
      view: ProjectListView.Current,
    });
  });

  it('coerces query numbers and normalizes search text', async () => {
    const dto = plainToInstance(ListProjectsQueryDto, {
      page: '2',
      limit: '50',
      search: '  k2h project  ',
      status: ProjectStatus.Active,
      view: ProjectListView.Archived,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({
      page: 2,
      limit: 50,
      search: 'k2h project',
      status: ProjectStatus.Active,
      view: ProjectListView.Archived,
    });
  });

  it('normalizes blank search text to undefined', async () => {
    const dto = plainToInstance(ListProjectsQueryDto, { search: '   ' });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.search).toBeUndefined();
  });

  it.each([
    { page: '0' },
    { page: '1.5' },
    { limit: '0' },
    { limit: '101' },
    { status: 'PAUSED' },
    { view: 'all' },
    { search: 'a'.repeat(101) },
  ])('rejects invalid query input %#', async (input) => {
    const dto = plainToInstance(ListProjectsQueryDto, input);

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });
});
