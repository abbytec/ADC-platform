import { IModule } from "./IModule.js";

export interface IMiddleware<T> extends IModule {
	getInstance(options?: any): Promise<T> | T;
}
