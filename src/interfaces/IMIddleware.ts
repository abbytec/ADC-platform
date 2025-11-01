export interface IMiddleware<T> {
  name: symbol;
  getInstance(): Promise<T> | T;
  shutdown?(): Promise<void>;
}