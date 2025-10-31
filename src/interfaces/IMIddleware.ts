export interface IMiddleware<T> {
  capability: symbol;
  getInstance(): Promise<T> | T;
  shutdown?(): Promise<void>;
}