/** Configuration for the RabbitMQ provider */
export interface RabbitMQProviderConfig {
	url?: string;
	defaultPrefetch?: number;
	defaultConcurrency?: number;
	maxRetries?: number;
	/** Delay per retry level in ms - forms exponential backoff via dedicated TTL queues */
	retryDelaysMs?: number[];
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
	/** Max time (ms) the handler may run before being considered failed */
	jobTimeoutMs?: number;
}

/** Inbound message delivered to the operation consumer handler */
export interface OperationMessage {
	body: Record<string, unknown>;
	headers: Record<string, string>;
	routingKey: string;
}
