export interface ILifecycle {
	start?(kernelKey?: symbol): Promise<void>;
	stop?(kernelKey?: symbol): Promise<void>;
}
