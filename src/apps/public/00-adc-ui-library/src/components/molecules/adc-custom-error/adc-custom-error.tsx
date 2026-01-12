import { Component, Prop, State, h, Element, Watch } from "@stencil/core";

export type ErrorSeverity = "info" | "warning" | "error" | "success";

export interface ErrorKeyConfig {
	key: string;
	severity?: ErrorSeverity;
}

export interface ADCErrorEvent {
	errorKey: string;
	message: string;
	severity?: ErrorSeverity;
	data?: Record<string, unknown>;
}

interface DisplayedError extends ADCErrorEvent {
	id: number;
	timeout?: ReturnType<typeof setTimeout>;
}

/**
 * Global error display component with callout and toast variants.
 *
 * Use multiple instances to separate error handling:
 * - One global toast handler for unhandled errors
 * - Specific callout handlers for expected errors in forms
 *
 * @example
 * ```html
 * <!-- Global toast handler -->
 * <adc-custom-error variant="toast" global handle-unhandled></adc-custom-error>
 *
 * <!-- Form-specific callout handler -->
 * <adc-custom-error variant="callout" keys='[{"key": "INVALID_CREDENTIALS", "severity": "error"}]'></adc-custom-error>
 * ```
 */
@Component({
	tag: "adc-custom-error",
	shadow: false,
})
export class AdcCustomError {
	@Element() el!: HTMLElement;

	/** Display variant: callout (inline) or toast (floating notification) */
	@Prop() variant: "callout" | "toast" = "toast";

	/** If true, catches all errors not handled by specific key handlers */
	@Prop() global: boolean = false;

	/** If true, listens for unhandled promise rejections */
	@Prop() handleUnhandled: boolean = false;

	/** JSON array of error keys to handle. If empty and not global, shows warning. */
	@Prop() keys?: string;

	/** Auto-dismiss timeout in ms (only for toast variant). 0 = no auto-dismiss */
	@Prop() dismissTimeout: number = 3000;

	/** Maximum number of stacked toasts */
	@Prop() maxStack: number = 5;

	@State() errors: DisplayedError[] = [];

	private parsedKeys: ErrorKeyConfig[] = [];
	private errorIdCounter = 0;
	private boundHandleError = this.handleError.bind(this);
	private boundHandleUnhandledRejection = this.handleUnhandledRejection.bind(this);
	private boundHandleClear = this.handleClear.bind(this);

	@Watch("keys")
	parseKeys(newValue: string | undefined) {
		if (!newValue) {
			this.parsedKeys = [];
			return;
		}
		try {
			const parsed = JSON.parse(newValue);
			this.parsedKeys = Array.isArray(parsed) ? parsed.map((k) => (typeof k === "string" ? { key: k } : k)) : [];
		} catch {
			console.error("[adc-custom-error] Invalid keys JSON:", newValue);
			this.parsedKeys = [];
		}
	}

	connectedCallback() {
		this.parseKeys(this.keys);

		// Validate configuration
		if (!this.global && this.parsedKeys.length === 0) {
			console.error(
				"[adc-custom-error] Component has no keys specified and is not global. " + "Either specify keys prop or set global=true."
			);
		}

		// Listen for custom error events
		window.addEventListener("adc-error", this.boundHandleError as EventListener);

		// Listen for clear events
		window.addEventListener("adc-error-clear", this.boundHandleClear);

		// Listen for unhandled rejections if enabled
		if (this.handleUnhandled) {
			if (!this.global && this.parsedKeys.length === 0) {
				console.error("[adc-custom-error] handleUnhandled requires either global=true or keys to be specified.");
			} else {
				window.addEventListener("unhandledrejection", this.boundHandleUnhandledRejection);
			}
		}
	}

	disconnectedCallback() {
		window.removeEventListener("adc-error", this.boundHandleError as EventListener);
		window.removeEventListener("adc-error-clear", this.boundHandleClear);
		if (this.handleUnhandled) {
			window.removeEventListener("unhandledrejection", this.boundHandleUnhandledRejection);
		}
		// Clear all timeouts
		this.errors.forEach((err) => {
			if (err.timeout) clearTimeout(err.timeout);
		});
	}

	private handleClear() {
		this.errors.forEach((err) => {
			if (err.timeout) clearTimeout(err.timeout);
		});
		this.errors = [];
	}

	private handleUnhandledRejection(event: PromiseRejectionEvent) {
		const reason = event.reason;

		// Check if it's an ADCCustomError-like object
		if (reason && typeof reason === "object" && "errorKey" in reason) {
			this.handleError(
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
		} else if (this.global) {
			// Generic unhandled error
			this.handleError(
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
	}

	private handleError(event: CustomEvent<ADCErrorEvent>) {
		const errorData = event.detail;
		if (!errorData?.errorKey) return;

		// Check if this handler should process this error
		const keyConfig = this.parsedKeys.find((k) => k.key === errorData.errorKey);

		if (!keyConfig && !this.global) {
			// This handler doesn't handle this error key
			return;
		}

		// If there's a specific handler with this key, don't handle globally
		if (this.global && !keyConfig) {
			// Check if another handler will take this error
			const otherHandlers = Array.from(document.querySelectorAll("adc-custom-error"));
			for (const handler of otherHandlers) {
				if (handler === this.el) continue;
				const handlerKeys = handler.getAttribute("keys");
				if (handlerKeys) {
					try {
						const parsed = JSON.parse(handlerKeys);
						const hasKey =
							Array.isArray(parsed) &&
							parsed.some((k: string | ErrorKeyConfig) => (typeof k === "string" ? k : k.key) === errorData.errorKey);
						if (hasKey) {
							// Another specific handler will take this error
							return;
						}
					} catch {
						// Invalid JSON, ignore
					}
				}
			}
		}

		// Determine severity
		const severity = keyConfig?.severity || errorData.severity || "error";

		// Create error entry
		const errorEntry: DisplayedError = {
			...errorData,
			severity,
			id: ++this.errorIdCounter,
		};

		// Auto-dismiss for toast variant
		if (this.variant === "toast" && this.dismissTimeout > 0) {
			errorEntry.timeout = setTimeout(() => {
				this.dismissError(errorEntry.id);
			}, this.dismissTimeout);
		}

		// Add to stack (limit max)
		this.errors = [errorEntry, ...this.errors].slice(0, this.maxStack);
	}

	private dismissError(id: number) {
		const error = this.errors.find((e) => e.id === id);
		if (error?.timeout) clearTimeout(error.timeout);
		this.errors = this.errors.filter((e) => e.id !== id);
	}

	private getSeverityClass(severity: ErrorSeverity): string {
		switch (severity) {
			case "warning":
				return "bg-warn text-twarn border-twarn/45";
			case "success":
				return "bg-success text-tsuccess border-tsuccess/45";
			case "error":
				return "bg-danger text-tdanger border-tdanger/45";
			default:
				return "bg-info text-tinfo border-tinfo/45";
		}
	}

	private renderCallout() {
		if (this.errors.length === 0) return null;

		// For callout, show only the most recent error
		const error = this.errors[0];
		const classes = `rounded-xxl border p-3 mb-2 ${this.getSeverityClass(error.severity!)}`;

		return (
			<div class={classes} role="alert" aria-live="assertive" aria-atomic="true">
				<div class="flex items-center justify-between gap-2">
					<span>{error.message}</span>
					<button
						type="button"
						class="opacity-70 hover:opacity-100 transition-opacity"
						onClick={() => this.dismissError(error.id)}
						aria-label="Dismiss"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			</div>
		);
	}

	private renderToast() {
		if (this.errors.length === 0) return null;

		return (
			<div class="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
				{this.errors.map((error) => {
					const classes = `rounded-xxl border p-3 shadow-lg backdrop-blur-sm animate-slide-in ${this.getSeverityClass(
						error.severity!
					)}`;
					return (
						<div key={error.id} class={classes} role="alert" aria-live="polite">
							<div class="flex items-start justify-between gap-2">
								<span class="flex-1">{error.message}</span>
								<button
									type="button"
									class="opacity-70 hover:opacity-100 transition-opacity shrink-0"
									onClick={() => this.dismissError(error.id)}
									aria-label="Dismiss"
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>
						</div>
					);
				})}
			</div>
		);
	}

	render() {
		return this.variant === "callout" ? this.renderCallout() : this.renderToast();
	}
}
