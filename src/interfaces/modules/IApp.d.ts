import { ILifecycle } from "../behaviours/ILifecycle.d.ts";
export interface IApp extends ILifecycle {
	name: string;
	run(): Promise<void>;
	loadModulesFromConfig(): Promise<void>;
}
