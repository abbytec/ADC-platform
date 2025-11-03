import { ILifecycle } from "../behaviours/ILifecycle.js";

export interface IMiddleware<T> extends ILifecycle {
	name: string;
	getInstance(options?: any): Promise<T> | T;
}
