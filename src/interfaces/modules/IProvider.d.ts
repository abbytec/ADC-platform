import { ILifecycle } from "../behaviours/ILifecycle.d.ts";

export interface IProvider<T> extends ILifecycle {
	name: string;
	type: string;
	getInstance(options?: any): Promise<T> | T;
}
