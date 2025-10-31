import { IKernel } from "./IKernel.js";

export interface IApp {
  name: string;
  start(kernel: IKernel): Promise<void>;
  stop(): Promise<void>;
}
