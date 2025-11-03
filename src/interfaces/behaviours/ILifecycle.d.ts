export interface ILifecycle {
	start?(): Promise<void>;
	stop?(): Promise<void>;
}
