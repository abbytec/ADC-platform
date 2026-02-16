import { Component, Prop, h } from "@stencil/core";
import type { AccessMenuItem } from "../../molecules/adc-access-button/adc-access-button.js";

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

	/** URL base para auth (dev vs prod) */
	@Prop() authUrl: string =
		`${globalThis.location?.protocol}//auth.adigitalcafe.com${globalThis.location?.port ? `:${globalThis.location?.port}` : ""}`;

	/** URL base de la API (en dev: http://localhost:3000, en prod: vacío) */
	@Prop() apiBaseUrl: string = ["localhost", "127.0.0.1"].includes(globalThis.location?.hostname)
		? `${globalThis.location?.protocol}//${globalThis.location?.hostname}:3000`
		: "";

	/** Mostrar botón de acceso/perfil */
	@Prop() showAccessButton: boolean = true;

	/** Items del menú de usuario (array de {label, href, icon?}) */
	@Prop() userMenuItems: AccessMenuItem[] = [];

	render() {
		return (
			<header class="flex items-center justify-between gap-6 px-8 py-6 shadow-cozy bg-header text-theader font-bold rounded-b-xxl">
				<a href={this.homeHref} aria-label="Inicio" class="ml-2">
					{this.logoSrc && (
						<img src={this.logoSrc} alt={this.logoAlt} height="36" width="36" style={{ minWidth: "36px" }} class="rounded-full" />
					)}
				</a>

				<nav class="flex flex-wrap items-center gap-4" style={{ minHeight: "48px" }} aria-label="Menu">
					<slot></slot>

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
