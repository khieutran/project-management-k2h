import type { INestApplication } from '@nestjs/common';
import {
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';

import { setupSwagger } from './setup-swagger';

describe('setupSwagger', () => {
  const app = {} as INestApplication;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates documentation at api/docs when enabled', () => {
    const document = {
      openapi: '3.0.0',
      info: {
        title: 'Project Management K2H API',
        version: '0.1.0',
      },
      paths: {},
    } as OpenAPIObject;

    const createDocumentSpy = jest
      .spyOn(SwaggerModule, 'createDocument')
      .mockReturnValue(document);

    const setupSpy = jest
      .spyOn(SwaggerModule, 'setup')
      .mockImplementation(() => undefined);

    setupSwagger(app, true);

    expect(createDocumentSpy).toHaveBeenCalledTimes(1);

    expect(createDocumentSpy).toHaveBeenCalledWith(
      app,
      expect.objectContaining({
        info: expect.objectContaining({
          title: 'Project Management K2H API',
          version: '0.1.0',
        }),
        components: expect.objectContaining({
          securitySchemes: expect.objectContaining({
            'access-token': expect.objectContaining({
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            }),
            'refresh-token': expect.objectContaining({
              type: 'apiKey',
              in: 'cookie',
              name: 'refresh_token',
            }),
          }),
        }),
      }),
    );

    expect(setupSpy).toHaveBeenCalledTimes(1);
    expect(setupSpy).toHaveBeenCalledWith(
      'api/docs',
      app,
      document,
    );
  });

  it('does not create documentation when disabled', () => {
    const createDocumentSpy = jest.spyOn(
      SwaggerModule,
      'createDocument',
    );

    const setupSpy = jest.spyOn(
      SwaggerModule,
      'setup',
    );

    setupSwagger(app, false);

    expect(createDocumentSpy).not.toHaveBeenCalled();
    expect(setupSpy).not.toHaveBeenCalled();
  });
});
