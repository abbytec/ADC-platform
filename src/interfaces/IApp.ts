export interface IApp {
  name: string;
  start?(): Promise<void>;
  run(): Promise<void>;
  stop?(): Promise<void>;
}
