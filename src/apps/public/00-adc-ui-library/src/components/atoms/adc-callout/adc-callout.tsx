import { Component, Prop, h } from "@stencil/core";

@Component({
	tag: "adc-callout",
	shadow: false,
})
export class AdcCallout {
	@Prop() tone: "info" | "warning" | "success" | "error" = "info";
	@Prop() role: "note" | "status" | "alert" = "note";

	private getToneClass(): string {
		switch (this.tone) {
			case "warning":
				return "bg-yellow-100/30 border-yellow-600 text-yellow-900";
			case "success":
				return "bg-green-100/30 border-green-600 text-green-900";
			case "error":
				return "bg-red-100/30 border-red-600 text-red-900";
			default:
				return "bg-cyan-100/30 border-blue-600 text-blue-900";
		}
	}

	render() {
		const classes = `rounded-xxl border p-3 mb-2 ml-8 xl:max-w-[80vw] ${this.getToneClass()}`;

		if (this.role === "note") {
			return (
				<aside class={classes} role="note">
					<slot></slot>
				</aside>
			);
		}

		if (this.role === "status") {
			return (
				<output class={classes} aria-live="polite" aria-atomic="false">
					<slot></slot>
				</output>
			);
		}

		return (
			<div class={classes} role="alert" aria-live="assertive" aria-atomic="true">
				<slot></slot>
			</div>
		);
	}
}
