import { Component, Prop, h, Event, EventEmitter, Element } from "@stencil/core";

@Component({
	tag: "adc-button-expand",
	shadow: false,
})
export class AdcButtonExpand {
	@Element() el!: HTMLElement;

	@Prop() isExpanded: boolean = false;
	@Prop() ariaLabel: string = "Expandir menú";
	@Prop() ariaControls?: string;

	@Event() adcExpandToggle!: EventEmitter<boolean>;

	private readonly handleClick = () => {
		this.adcExpandToggle.emit(!this.isExpanded);
	};

	private readonly baseClass =
		"rounded-full p-3 bg-primary text-tprimary shadow-cozy cursor-pointer hover:brightness-105 inline-flex items-center justify-center min-h-[44px] min-w-[44px] touch-manipulation transition-transform duration-300";

	render() {
		// Si NO está expandido, flecha hacia la derecha; si está expandido mantiene su forma original
		//const iconClass = this.isExpanded ? "" : "rotate-180";

		return (
			<button
				type="button"
				class={this.baseClass}
				aria-label={this.ariaLabel}
				aria-expanded={this.isExpanded}
				aria-controls={this.ariaControls}
				onClick={this.handleClick}
			>
				{/* <svg
					class={`w-6 h-6 transition-transform duration-300 ${iconClass}`}
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path d="M10 6L4 12L10 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
					<path d="M4 12H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
				</svg> */}
				<adc-icon-line-arrow-right></adc-icon-line-arrow-right>
			</button>
		);
	}
}
