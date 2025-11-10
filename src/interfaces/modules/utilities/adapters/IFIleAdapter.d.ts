import { Buffer } from 'node:buffer';

export interface IFileAdapter<T> {
  toBuffer(data: T): Buffer | Promise<Buffer>;
  fromBuffer(buffer: Buffer): T | Promise<T>;
}