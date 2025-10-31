export const QUEUE_CAPABILITY = Symbol.for("IMessageQueue");

export interface IMessageQueue {
  publish(topic: string, message: any): Promise<void>;
  subscribe(topic: string, handler: (message: any) => void): Promise<void>;
}