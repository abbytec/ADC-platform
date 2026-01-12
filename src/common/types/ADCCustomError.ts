/**
 * Base abstract class for all ADC Platform errors
 * All custom error types should extend this class
 */
export default abstract class ADCCustomError extends Error {
	public abstract readonly name: string;
	public readonly status: number;
	public readonly errorKey: string;
	public readonly data?: Record<string, unknown>;

	constructor(status: number, errorKey: string, message: string, data?: Record<string, unknown>) {
		super(message);
		this.status = status;
		this.errorKey = errorKey;
		this.data = data;
		if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
	}

	toJSON() {
		return {
			name: this.name,
			status: this.status,
			errorKey: this.errorKey,
			message: this.message,
			data: this.data,
		};
	}
}
