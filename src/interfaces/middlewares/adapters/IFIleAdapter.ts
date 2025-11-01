import { Buffer } from 'node:buffer';

export interface IFileAdapter<T> {
  toBuffer(data: T): Buffer;
  fromBuffer(buffer: Buffer): T;
}