export interface IProvider<T> {
	name: symbol;
	type: symbol;
	getInstance(options?: any): Promise<T> | T;
	shutdown?(): Promise<void>;
}
