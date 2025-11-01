import { IKernel } from "./IKernel.js";

export interface IApp {
  name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}
