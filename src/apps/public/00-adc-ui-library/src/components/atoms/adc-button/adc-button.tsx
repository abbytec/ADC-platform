import { Component, Prop, h, Event, EventEmitter } from "@stencil/core";
@Component({
	tag: "adc-button",
	shadow: false,
})
export class AdcButton {
	@Prop() type: "button" | "submit" | "reset" = "button";
	@Prop() variant: "primary" | "accent" = "primary";
	@Prop() href?: string;
	@Prop() ariaLabel?: string;

	@Event() adcClick!: EventEmitter<MouseEvent>;

	private handleClick = (event: MouseEvent) => {
		this.adcClick.emit(event);
	};

	private baseClass =
		"rounded-3xl px-8 py-4 bg-primary text-tprimary shadow-cozy font-heading cursor-pointer hover:brightness-105 inline-block text-center font-semibold min-h-[44px] min-w-[44px] touch-manipulation";

	render() {
		if (this.href) {
			return (
				<a
					href={this.href}
					target="_blank"
					rel="noopener noreferrer"
					class={this.baseClass}
					aria-label={this.ariaLabel}
					onClick={this.handleClick}
				>
					<slot></slot>
				</a>
			);
		}

		return (
			<button type={this.type} class={this.baseClass} aria-label={this.ariaLabel} onClick={this.handleClick}>
				<slot></slot>
			</button>
		);
	}
}
