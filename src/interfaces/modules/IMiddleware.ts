export interface IMiddleware<T> {
  name: string;
  getInstance(options?: any): Promise<T> | T;
  shutdown?(): Promise<void>;
}