import { IModule } from "./IModule.js";

export interface IProvider<T> extends IModule {
	type: string;
	getInstance(options?: any): Promise<T> | T;
}
