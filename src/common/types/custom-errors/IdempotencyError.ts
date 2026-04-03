import ADCCustomError, { type ADCCustomErrorJSON } from "../ADCCustomError.ts";

type IdempotencyErrorData = {
	retryAfterSeconds?: number;
};

type IdempotencyErrorTypes = "IDEMPOTENCY_RUNNING" | "IDEMPOTENCY_KEY_MISSING";

export class IdempotencyError extends ADCCustomError<IdempotencyErrorData, IdempotencyErrorTypes> {
	public readonly name = "IdempotencyError";
}

/**
 * @public
 */
export type ADCIdempotencyErrorJSON = ADCCustomErrorJSON<IdempotencyErrorData, IdempotencyErrorTypes>;
