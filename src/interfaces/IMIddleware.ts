export interface IMiddleware<T> {
  name: string;
  getInstance(): Promise<T> | T;
  shutdown?(): Promise<void>;
}