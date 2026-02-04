/**
 * Event handler utilities for adc-custom-error component
 */

import type { ADCErrorEvent } from "./types.js";

interface UnhandledRejectionContext {
	global: boolean;
	handleError: (event: CustomEvent<ADCErrorEvent>) => void;
}

/**
 * Creates handler for unhandled promise rejections.
 * Converts rejection reasons to ADCErrorEvent format.
 */
export function createUnhandledRejectionHandler(ctx: UnhandledRejectionContext) {
	return (event: PromiseRejectionEvent) => {
		const reason = event.reason;

		if (reason && typeof reason === "object" && "errorKey" in reason) {
			ctx.handleError(
				new CustomEvent("adc-error", {
					detail: {
						errorKey: reason.errorKey,
						message: reason.message || "Unknown error",
						severity: "error",
						data: reason.data,
					},
				})
			);
			event.preventDefault();
		} else if (ctx.global) {
			ctx.handleError(
				new CustomEvent("adc-error", {
					detail: {
						errorKey: "UNHANDLED_ERROR",
						message: reason?.message || String(reason) || "An unexpected error occurred",
						severity: "error",
					},
				})
			);
			event.preventDefault();
		}
	};
}
