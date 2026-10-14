import { ApiError } from '../../api/api-error';

export function getProjectErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Không thể xử lý yêu cầu. Vui lòng thử lại.';
}
