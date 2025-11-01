import { Buffer } from 'node:buffer';

export interface IFileAdapter<T> {
  toBuffer(data: T): Buffer;
  fromBuffer(buffer: Buffer): T;
}

export const FILE_JSON_ADAPTER = Symbol.for("FILE_JSON_ADAPTER");