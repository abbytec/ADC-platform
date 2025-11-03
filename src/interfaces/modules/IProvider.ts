export interface IProvider<T> {
	name: string;
	type: string;
	getInstance(options?: any): Promise<T> | T;
	shutdown?(): Promise<void>;
}
