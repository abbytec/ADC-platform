/**
 * Types and interfaces for adc-custom-error component
 */

export type ErrorSeverity = "info" | "warning" | "error" | "success";

export interface ErrorKeyConfig {
	key: string;
	severity?: ErrorSeverity;
}

export interface ADCErrorEvent {
	errorKey: string;
	message: string;
	severity?: ErrorSeverity;
	data?: Record<string, unknown> & {
		httpStatus?: number;
		translationParams?: Record<string, string>;
	};
}

export interface DisplayedError extends ADCErrorEvent {
	id: number;
	timeout?: ReturnType<typeof setTimeout>;
}
