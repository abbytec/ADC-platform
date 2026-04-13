import { Component, Prop, State, h, Method } from "@stencil/core";

@Component({ tag: "adc-toast", shadow: false })
export class AdcToast {
	@Prop() message: string = "";

	@Prop() duration: number = 3000;

	/** Show/hide toast */
	@State() visible: boolean = false;

	private timeoutId?: any;

	@Method()
	async show(message?: string) {
		if (message) this.message = message;

		this.visible = true;

		if (this.timeoutId) clearTimeout(this.timeoutId);

		if (this.duration > 0) {
			this.timeoutId = setTimeout(() => this.close(), this.duration);
		}
	}

	@Method()
	async close() {
		this.visible = false;
	}

	disconnectedCallback() {
		if (this.timeoutId) clearTimeout(this.timeoutId);
	}

	render() {
		if (!this.visible) return null;

		return (
			<div
				class="fixed top-6 right-6 z-50 min-w-[220px] max-w-[350px] px-6 py-4 rounded-xl shadow-lg flex items-center text-base font-medium gap-4 transition-all bg-success text-tsuccess"
				role="status"
			>
				<span>{this.message}</span>

				<button
					class="ml-auto text-tsuccess text-xl font-bold opacity-80 hover:opacity-100 transition-opacity"
					onClick={() => this.close()}
					aria-label="Cerrar notificación"
				>
					×
				</button>
			</div>
		);
	}
}
