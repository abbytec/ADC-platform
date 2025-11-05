import { IModule } from "./IModule.js";

export interface IUtility<T> extends IModule {
	getInstance(options?: any): Promise<T>;
}
