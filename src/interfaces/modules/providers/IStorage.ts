import { Buffer } from 'node:buffer';

export const STORAGE_PROVIDER = "storage-provider";

export interface IStorage {
  save(key: string, data: Buffer): Promise<void>;
  load(key: string): Promise<Buffer | null>;
}