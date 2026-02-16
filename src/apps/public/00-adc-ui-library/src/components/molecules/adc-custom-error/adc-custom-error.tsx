/**
 * Error display component with callout (inline) and toast (floating) variants.
 * @see README.md for usage examples
 */

import { Component, Prop, State, Element, Watch } from "@stencil/core";
import type { ErrorKeyConfig, ADCErrorEvent, DisplayedError } from "./types.js";
import { registerClaimedKeys, recalculateClaimedKeys } from "./error-registry.js";
import { renderCallout, renderToast } from "./error-renderers.js";
import { resolveErrorMessage } from "./error-translator.js";
import { createUnhandledRejectionHandler } from "./event-handlers.js";

// Types re-exported from ./types.js for external use

@Component({ tag: "adc-custom-error", shadow: false })
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
	@Prop() dismissTimeout: number = 5000;

	/** Maximum number of stacked toasts */
	@Prop() maxStack: number = 5;
	@State() errors: DisplayedError[] = [];

	private parsedKeys: ErrorKeyConfig[] = [];
	private errorIdCounter = 0;
	private boundHandleError = this.handleError.bind(this);
	private boundHandleUnhandledRejection!: (e: PromiseRejectionEvent) => void;
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
		if (!this.global && this.parsedKeys.length === 0) {
			console.error("[adc-custom-error] Component has no keys specified and is not global.");
		}
		if (!this.global && this.parsedKeys.length > 0) {
			registerClaimedKeys(this.parsedKeys);
		}
		globalThis.addEventListener("adc-error", this.boundHandleError as EventListener);
		globalThis.addEventListener("adc-error-clear", this.boundHandleClear);
		if (this.handleUnhandled) {
			if (!this.global && this.parsedKeys.length === 0) {
				console.error("[adc-custom-error] handleUnhandled requires either global=true or keys.");
			} else {
				this.boundHandleUnhandledRejection = createUnhandledRejectionHandler({
					global: this.global,
					handleError: this.boundHandleError,
				});
				globalThis.addEventListener("unhandledrejection", this.boundHandleUnhandledRejection);
			}
		}
	}

	disconnectedCallback() {
		globalThis.removeEventListener("adc-error", this.boundHandleError as EventListener);
		globalThis.removeEventListener("adc-error-clear", this.boundHandleClear);
		if (this.handleUnhandled && this.boundHandleUnhandledRejection) {
			globalThis.removeEventListener("unhandledrejection", this.boundHandleUnhandledRejection);
		}
		if (!this.global && this.parsedKeys.length > 0) recalculateClaimedKeys();
		this.errors.forEach((err) => err.timeout && clearTimeout(err.timeout));
	}

	private handleClear() {
		this.errors.forEach((err) => err.timeout && clearTimeout(err.timeout));
		this.errors = [];
	}

	private handleError(event: CustomEvent<ADCErrorEvent>) {
		const errorData = event.detail;
		if (!errorData?.errorKey) return;

		const keyConfig = this.parsedKeys.find((k) => k.key === errorData.errorKey);

		// Specific handler: only handle if we have the key configured
		if (!this.global) {
			if (!keyConfig) return;
			// Mark event as handled by a specific handler
			(event.detail as ADCErrorEvent & { _handled?: boolean })._handled = true;
			this.addError(errorData, keyConfig);
			return;
		}

		// Global handler: defer to next microtask to let specific handlers mark it first
		queueMicrotask(() => {
			if ((event.detail as ADCErrorEvent & { _handled?: boolean })._handled) return;
			this.addError(errorData, keyConfig);
		});
	}

	private addError(errorData: ADCErrorEvent, keyConfig?: ErrorKeyConfig) {
		const errorEntry: DisplayedError = {
			...errorData,
			message: resolveErrorMessage(errorData),
			severity: keyConfig?.severity || errorData.severity || "error",
			id: ++this.errorIdCounter,
		};
		if (this.variant === "toast" && this.dismissTimeout > 0) {
			errorEntry.timeout = setTimeout(() => this.dismissError(errorEntry.id), this.dismissTimeout);
		}
		this.errors = [errorEntry, ...this.errors].slice(0, this.maxStack);
	}

	private dismissError(id: number) {
		const error = this.errors.find((e) => e.id === id);
		if (error?.timeout) clearTimeout(error.timeout);
		this.errors = this.errors.filter((e) => e.id !== id);
	}

	render() {
		const onDismiss = (id: number) => this.dismissError(id);
		return this.variant === "callout" ? renderCallout(this.errors, onDismiss) : renderToast(this.errors, onDismiss);
	}
}
