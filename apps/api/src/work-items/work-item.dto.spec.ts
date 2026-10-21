import { BadRequestException, type ArgumentMetadata } from '@nestjs/common';

import { createApplicationValidationPipe } from '../common/validation/create-application-validation-pipe';
import { UpdateWorkItemDto } from './work-item.dto';

const metadata: ArgumentMetadata = { type: 'body', metatype: UpdateWorkItemDto };

describe('UpdateWorkItemDto', () => {
  it.each(['title', 'status', 'priority', 'labels'])(
    'rejects null for non-nullable %s before persisting the work item',
    async (field) => {
      const pipe = createApplicationValidationPipe();

      await expect(pipe.transform({ [field]: null }, metadata)).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('allows null to clear the nullable description and due date', async () => {
    const pipe = createApplicationValidationPipe();

    await expect(pipe.transform({ description: null, dueDate: null }, metadata)).resolves.toMatchObject({
      description: null,
      dueDate: null,
    });
  });
});
