import { Component, Prop, h } from "@stencil/core";

export interface NavItem {
	label: string;
	href: string;
}

@Component({
	tag: "adc-site-header",
	shadow: false,
})
export class AdcSiteHeader {
	@Prop() logoSrc: string = "";
	@Prop() logoAlt: string = "";
	@Prop() homeHref: string = "/";

	render() {
		return (
			<header class="flex items-center justify-between gap-6 px-8 py-6 shadow-cozy bg-button/95 text-tbutton font-bold rounded-b-xxl">
				<a href={this.homeHref} aria-label="Inicio" class="ml-2">
					{this.logoSrc && (
						<img src={this.logoSrc} alt={this.logoAlt} height="36" width="36" style={{ minWidth: "36px" }} class="rounded-full" />
					)}
				</a>

				<nav class="flex flex-wrap items-center mr-8" style={{ minHeight: "48px" }} aria-label="Menu">
					<slot></slot>
				</nav>
			</header>
		);
	}
}
