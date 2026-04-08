import type { Publisher } from "rabbitmq-client";

/**
 * Publish a message to the main work exchange for a given operation.
 */
export async function publishToExchange(
	publisher: Publisher,
	serviceName: string,
	operationName: string,
	message: Record<string, unknown>,
	headers?: Record<string, string>
): Promise<void> {
	await publisher.send(
		{
			exchange: `svc.${serviceName}`,
			routingKey: operationName,
			headers: headers || {},
			durable: true,
		},
		message
	);
}

/**
 * Re-publish a message to a specific retry queue level.
 * The retry queue's TTL + DLX will route it back to the main queue automatically.
 */
export async function publishToRetryQueue(
	publisher: Publisher,
	serviceName: string,
	operationName: string,
	retryLevel: number,
	message: Record<string, unknown>,
	headers: Record<string, string>
): Promise<void> {
	await publisher.send(
		{
			exchange: `retry.${serviceName}`,
			routingKey: `${operationName}.retry.${retryLevel}`,
			headers,
			durable: true,
		},
		message
	);
}
