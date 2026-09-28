export type HealthResponse = {
  status: 'ok';
  database: 'up';
  environment: string;
};

export type UnhealthyResponse = {
  status: 'error';
  database: 'down';
  environment: string;
};