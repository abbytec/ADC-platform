export interface IProvider<T> {
	name: symbol;
	getInstance(options?: any): Promise<T> | T;
	shutdown?(): Promise<void>;
}
