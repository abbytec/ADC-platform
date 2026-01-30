export interface ADCCustomErrorJSON<T = Record<string, unknown>, M extends string = string> {
	name: string;
	status: number;
	errorKey: M;
	message: string;
	data?: T;
}

/**
 * Base abstract class for all ADC Platform errors
 * All custom error types should extend this class
 */
export default abstract class ADCCustomError<T = Record<string, unknown>, M extends string = string> extends Error {
	public abstract readonly name: string;
	public readonly status: number;
	public readonly errorKey: M;
	public readonly data?: T;

	constructor(status: number, errorKey: M, message: string, data?: T) {
		super(message);
		this.status = status;
		this.errorKey = errorKey;
		this.data = data;
		if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
	}

	toJSON(): ADCCustomErrorJSON<T, M> {
		return {
			name: this.name,
			status: this.status,
			errorKey: this.errorKey,
			message: this.message,
			data: this.data,
		};
	}
}

/** Data específica para errores de autenticación */
export { type AuthErrorTypes, AuthError, type ADCAuthErrorJSON } from "./custom-errors/AuthError.js";

export class HttpError extends ADCCustomError {
	public readonly name = "HttpError";
}
