import { Buffer } from 'node:buffer';

export interface IFileAdapter<T> {
  toBuffer(data: T): Buffer;
  fromBuffer(buffer: Buffer): T;
}

export const JSON_ADAPTER_CAPABILITY = Symbol.for("JSON_ADAPTER_CAPABILITY");