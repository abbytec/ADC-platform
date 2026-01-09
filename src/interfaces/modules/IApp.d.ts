import { IModule } from "./IModule.d.ts";
export interface IApp extends IModule {
	run(): Promise<void>;
	loadModulesFromConfig(): Promise<void>;
	setKernelKey(key: symbol): void;
}
