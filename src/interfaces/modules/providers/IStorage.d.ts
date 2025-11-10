import { Buffer } from "node:buffer";

export interface IStorage {
	save(key: string, data: Buffer): Promise<void>;
	load(key: string): Promise<Buffer | null>;
	delete(key: string): Promise<void>;
	list(subPath?: string): Promise<string[]>;
}
