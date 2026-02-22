import { Component, Prop, h, Event, EventEmitter } from "@stencil/core";

@Component({
	tag: "adc-button-rounded",
	shadow: false,
})
export class AdcButtonRounded {
	@Prop() type: "button" | "submit" | "reset" = "button";
	@Prop() href?: string;
	@Prop() ariaLabel?: string;
	/** Visual variant */
	@Prop() variant: "default" | "danger" = "default";

	@Event() adcClick!: EventEmitter<MouseEvent>;

	private handleClick = (event: MouseEvent) => {
		this.adcClick.emit(event);
	};

	private getClass(): string {
		const base =
			"rounded-full p-2.5 shadow-cozy font-heading cursor-pointer hover:brightness-105 inline-flex items-center justify-center min-h-[44px] min-w-[44px] touch-manipulation";
		if (this.variant === "danger") return `${base} bg-tdanger text-danger`;
		return `${base} bg-primary text-tprimary`;
	}

	render() {
		const TagName = this.href ? "a" : "button";
		const attrs = this.href
			? {
					href: this.href,
					target: "_blank",
					rel: "noopener noreferrer",
				}
			: {
					type: this.type,
				};

		return (
			<TagName {...attrs} class={this.getClass()} aria-label={this.ariaLabel} onClick={this.handleClick}>
				<slot></slot>
			</TagName>
		);
	}
}
