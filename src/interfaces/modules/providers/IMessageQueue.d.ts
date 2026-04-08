export interface IMessageQueue {
	publish(topic: string, message: any): Promise<void>;
	subscribe(topic: string, handler: (message: any) => void): Promise<void>;
}

// ── RabbitMQ-specific interfaces ─────────────────────────────────────────────

/** Inbound message delivered to the operation consumer handler */
export interface OperationMessage {
	body: Record<string, unknown>;
	headers: Record<string, string>;
	routingKey: string;
}

/** Options when declaring topology for a specific operation */
export interface TopologyOptions {
	prefetch?: number;
	concurrency?: number;
	maxRetries?: number;
	retryDelaysMs?: number[];
}

/** Options when creating a consumer for an operation */
export interface ConsumerOptions {
	prefetch?: number;
	concurrency?: number;
	/** Max time (ms) a handler may run before being considered failed */
	jobTimeoutMs?: number;
}

/**
 * Extended message queue provider with operation-level topology,
 * retry queues, dead-letter handling, and consumer management.
 */
export interface IRabbitMQProvider extends IMessageQueue {
	declareOperationTopology(serviceName: string, operationName: string, options?: TopologyOptions): Promise<void>;
	publish(serviceName: string, operationName: string, message: unknown, headers?: Record<string, string>): Promise<void>;
	publishToRetry(
		serviceName: string,
		operationName: string,
		retryLevel: number,
		message: unknown,
		headers: Record<string, string>
	): Promise<void>;
	createOperationConsumer(
		serviceName: string,
		operationName: string,
		handler: (msg: OperationMessage) => Promise<void>,
		options?: ConsumerOptions
	): unknown; // Consumer instance - opaque to callers
}
