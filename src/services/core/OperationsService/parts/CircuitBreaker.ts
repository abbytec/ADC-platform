import { CircuitOpenError } from "@common/types/custom-errors/CircuitOpenError.ts";

/** Circuit breaker states */
export const enum CircuitState {
	CLOSED = "CLOSED",
	OPEN = "OPEN",
	HALF_OPEN = "HALF_OPEN",
}

export interface CircuitBreakerConfig {
	/** Number of consecutive failures before opening the circuit */
	failureThreshold?: number;
	/** Time (ms) the circuit stays OPEN before transitioning to HALF_OPEN */
	resetTimeoutMs?: number;
	/** Max attempts allowed in HALF_OPEN state before deciding */
	halfOpenMaxAttempts?: number;
}

interface CircuitEntry {
	state: CircuitState;
	failures: number;
	successes: number;
	halfOpenAttempts: number;
	lastFailureTime: number;
}

const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_RESET_TIMEOUT_MS = 30_000;
const DEFAULT_HALF_OPEN_MAX = 2;

/**
 * Per-operation circuit breaker.
 *
 * Used ONLY on the consumer (worker) side to protect downstream dependencies.
 * The HTTP producer never consults the circuit breaker.
 *
 * States:
 *   CLOSED    → normal operation, tracking failures
 *   OPEN      → all calls rejected immediately (CircuitOpenError)
 *   HALF_OPEN → limited attempts allowed to test recovery
 */
export class CircuitBreaker {
	readonly #failureThreshold: number;
	readonly #resetTimeoutMs: number;
	readonly #halfOpenMax: number;
	readonly #circuits = new Map<string, CircuitEntry>();

	constructor(config?: CircuitBreakerConfig) {
		this.#failureThreshold = config?.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
		this.#resetTimeoutMs = config?.resetTimeoutMs ?? DEFAULT_RESET_TIMEOUT_MS;
		this.#halfOpenMax = config?.halfOpenMaxAttempts ?? DEFAULT_HALF_OPEN_MAX;
	}

	/**
	 * Execute `fn` under circuit breaker protection.
	 * @param operationKey Unique key, e.g. "IdentityManagerService.deleteOrganization"
	 */
	async execute<T>(operationKey: string, fn: () => Promise<T>): Promise<T> {
		const entry = this.#getOrCreate(operationKey);

		// Check for state transition OPEN → HALF_OPEN based on elapsed time
		if (entry.state === CircuitState.OPEN) {
			if (Date.now() - entry.lastFailureTime >= this.#resetTimeoutMs) {
				entry.state = CircuitState.HALF_OPEN;
				entry.halfOpenAttempts = 0;
				entry.successes = 0;
			} else {
				const retryAfter = Math.ceil((this.#resetTimeoutMs - (Date.now() - entry.lastFailureTime)) / 1000);
				throw new CircuitOpenError(operationKey, retryAfter);
			}
		}

		// In HALF_OPEN: only allow a limited number of attempts
		if (entry.state === CircuitState.HALF_OPEN && entry.halfOpenAttempts >= this.#halfOpenMax) {
			throw new CircuitOpenError(operationKey, Math.ceil(this.#resetTimeoutMs / 1000));
		}

		if (entry.state === CircuitState.HALF_OPEN) {
			entry.halfOpenAttempts++;
		}

		try {
			const result = await fn();
			this.#onSuccess(entry);
			return result;
		} catch (error) {
			this.#onFailure(entry);
			throw error;
		}
	}

	/** Get the current state for an operation */
	getState(operationKey: string): CircuitState {
		const entry = this.#circuits.get(operationKey);
		if (!entry) return CircuitState.CLOSED;

		// Check if OPEN should have transitioned to HALF_OPEN
		if (entry.state === CircuitState.OPEN && Date.now() - entry.lastFailureTime >= this.#resetTimeoutMs) {
			return CircuitState.HALF_OPEN;
		}
		return entry.state;
	}

	/** Manually reset an operation's circuit to CLOSED */
	reset(operationKey: string): void {
		this.#circuits.delete(operationKey);
	}

	/** Get stats for all tracked operations */
	getStats(): Record<string, { state: CircuitState; failures: number }> {
		const stats: Record<string, { state: CircuitState; failures: number }> = {};
		for (const [key, entry] of this.#circuits) {
			stats[key] = { state: this.getState(key), failures: entry.failures };
		}
		return stats;
	}

	// ─── Internal ────────────────────────────────────────────────────────────────

	#getOrCreate(key: string): CircuitEntry {
		let entry = this.#circuits.get(key);
		if (!entry) {
			entry = {
				state: CircuitState.CLOSED,
				failures: 0,
				successes: 0,
				halfOpenAttempts: 0,
				lastFailureTime: 0,
			};
			this.#circuits.set(key, entry);
		}
		return entry;
	}

	#onSuccess(entry: CircuitEntry): void {
		if (entry.state === CircuitState.HALF_OPEN) {
			entry.successes++;
			if (entry.successes >= this.#halfOpenMax) {
				// Enough successes in HALF_OPEN → CLOSED
				entry.state = CircuitState.CLOSED;
				entry.failures = 0;
				entry.successes = 0;
				entry.halfOpenAttempts = 0;
			}
		} else {
			// CLOSED: reset failure count on success
			entry.failures = 0;
		}
	}

	#onFailure(entry: CircuitEntry): void {
		entry.failures++;
		entry.lastFailureTime = Date.now();

		if (entry.state === CircuitState.HALF_OPEN) {
			// Any failure in HALF_OPEN → back to OPEN
			entry.state = CircuitState.OPEN;
			entry.halfOpenAttempts = 0;
			entry.successes = 0;
		} else if (entry.state === CircuitState.CLOSED && entry.failures >= this.#failureThreshold) {
			entry.state = CircuitState.OPEN;
		}
	}
}
