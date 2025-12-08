import { Component, Prop, h, Event, EventEmitter } from "@stencil/core";

@Component({
	tag: "adc-button-rounded",
	shadow: false,
})
export class AdcButtonRounded {
	@Prop() type: "button" | "submit" | "reset" = "button";
	@Prop() href?: string;
	@Prop() ariaLabel?: string;

	@Event() adcClick!: EventEmitter<MouseEvent>;

	private handleClick = (event: MouseEvent) => {
		this.adcClick.emit(event);
	};

	private baseClass = "rounded-full px-4 py-4 bg-button text-primary shadow-cozy font-heading cursor-pointer hover:brightness-105 inline-block text-center font-semibold min-h-[44px] min-w-[44px] touch-manipulation flex items-center justify-center";

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
			<TagName
				{...attrs}
				class={this.baseClass}
				aria-label={this.ariaLabel}
				onClick={this.handleClick}
			>
				<slot></slot>
			</TagName>
		);
	}
}
