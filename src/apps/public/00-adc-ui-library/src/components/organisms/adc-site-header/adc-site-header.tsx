import { Component, Prop, h, Element } from "@stencil/core";
import type { AccessMenuItem } from "../../molecules/adc-access-button/adc-access-button.js";
import { isPrivateHost } from "../../../utils/url.js";

@Component({
	tag: "adc-site-header",
	shadow: false,
})
export class AdcSiteHeader {
	@Element() el!: HTMLElement;

	@Prop() logoSrc: string = "";
	@Prop() logoAlt: string = "";
	@Prop() homeHref: string = "/";

	@Prop() authUrl: string =
		`${globalThis.location?.protocol}//auth.adigitalcafe.com${globalThis.location?.port ? `:${globalThis.location?.port}` : ""}`;

	@Prop() apiBaseUrl: string = isPrivateHost(globalThis.location?.hostname ?? "")
		? `${globalThis.location?.protocol}//${globalThis.location?.hostname}:3000`
		: "";

	@Prop() showAccessButton: boolean = true;
	@Prop() userMenuItems: AccessMenuItem[] = [];

	componentDidLoad() {
		this.updateVars();
		window.addEventListener("resize", this.updateVars);
		window.addEventListener("scroll", this.updateVars);
	}

	disconnectedCallback() {
		window.removeEventListener("resize", this.updateVars);
		window.removeEventListener("scroll", this.updateVars);
	}

	private updateVars = () => {
		const rect = this.el.getBoundingClientRect();

		const height = rect.height;
		const offset = Math.max(rect.bottom, 0);

		document.documentElement.style.setProperty("--header-h", `${height}px`);
		document.documentElement.style.setProperty("--header-offset", `${offset}px`);
	};

	render() {
		return (
			<header class="flex items-center justify-between gap-6 px-8 py-6 shadow-cozy bg-header text-theader font-bold rounded-b-xxl z-50">
				<a href={this.homeHref} aria-label="Inicio" class="ml-2">
					{this.logoSrc && (
						<img src={this.logoSrc} alt={this.logoAlt} height="36" width="36" style={{ minWidth: "36px" }} class="rounded-full" />
					)}
				</a>

				<nav class="flex flex-wrap items-center gap-4" style={{ minHeight: "48px" }} aria-label="Menu">
					<slot></slot>

					<adc-apps-menu></adc-apps-menu>

					{this.showAccessButton && (
						<adc-access-button
							auth-url={this.authUrl}
							api-base-url={this.apiBaseUrl}
							menuItems={this.userMenuItems}
						></adc-access-button>
					)}
				</nav>
			</header>
		);
	}
}