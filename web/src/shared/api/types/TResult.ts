export interface TResult<T = unknown> {
  code?: number | string;
  status?: number;
  message?: string;
  data: T;
  [key: string]: unknown;
}