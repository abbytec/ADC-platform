import ADCCustomError, { type ADCCustomErrorJSON } from "../ADCCustomError.ts";

type CircuitOpenErrorData = {
	retryAfterSeconds: number;
	operationKey: string;
};

type CircuitOpenErrorTypes = "CIRCUIT_OPEN";

/**
 * Thrown when the circuit breaker for an operation is in OPEN state,
 * meaning the downstream dependency is considered unhealthy.
 */
export class CircuitOpenError extends ADCCustomError<CircuitOpenErrorData, CircuitOpenErrorTypes> {
	public readonly name = "CircuitOpenError";

	constructor(operationKey: string, retryAfterSeconds: number) {
		super(503, "CIRCUIT_OPEN", `Circuit breaker open for ${operationKey}`, {
			retryAfterSeconds,
			operationKey,
		});
	}
}

/** @public */
export type ADCCircuitOpenErrorJSON = ADCCustomErrorJSON<CircuitOpenErrorData, CircuitOpenErrorTypes>;
