import { Component, Prop, h, Event, EventEmitter, State } from "@stencil/core";

@Component({
	tag: "adc-consent-banner",
	shadow: false,
})
export class AdcConsentBanner {
	@Prop() visible: boolean = false;
	@Prop() restrictedRegion: boolean = false;
	@Prop() privacyHref: string = "/privacy";
	@Prop() cookiesHref: string = "/cookies";

	@State() isVisible: boolean = false;

	@Event() adcAcceptAll!: EventEmitter<void>;
	@Event() adcAcceptAnalytics!: EventEmitter<void>;
	@Event() adcDeclineAll!: EventEmitter<void>;
	@Event() adcDeclineAnalytics!: EventEmitter<void>;
	@Event() adcAcknowledge!: EventEmitter<void>;

	componentWillLoad() {
		this.isVisible = this.visible;
	}

	componentWillUpdate() {
		this.isVisible = this.visible;
	}

	private handleAcceptAll = () => {
		this.adcAcceptAll.emit();
		this.isVisible = false;
	};

	private handleAcceptAnalytics = () => {
		this.adcAcceptAnalytics.emit();
		this.isVisible = false;
	};

	private handleDeclineAll = () => {
		this.adcDeclineAll.emit();
		this.isVisible = false;
	};

	private handleDeclineAnalytics = () => {
		this.adcDeclineAnalytics.emit();
		this.isVisible = false;
	};

	private handleAcknowledge = () => {
		this.adcAcknowledge.emit();
		this.isVisible = false;
	};

	render() {
		if (!this.isVisible) return null;

		return (
			<dialog open class="fixed inset-x-0 bottom-0 z-50 bg-transparent p-0 border-0" aria-live="polite" aria-labelledby="consent-title">
				<div class="mx-auto max-w-4xl bg-alt !mb-0 border border-alt shadow-cozy rounded-t-xxl p-4 text-text">
					<h2 id="consent-title" class="sr-only">
						Preferencias de privacidad
					</h2>

					{this.restrictedRegion ? (
						<div>
							<p class="text-sm leading-relaxed">
								Usamos cookies de analítica (Google Analytics 4) y medición (Microsoft Clarity) para mejorar el sitio. Podés aceptar sólo
								analítica o todas. Leé nuestra{" "}
								<a href={this.privacyHref} class="underline hover:no-underline">
									Política de Privacidad
								</a>{" "}
								y{" "}
								<a href={this.cookiesHref} class="underline hover:no-underline">
									Política de Cookies
								</a>
								.
							</p>
							<div class="mt-3 flex flex-wrap gap-2 justify-end">
								<adc-button class="px-4 py-2 text-sm rounded-xxl text-primary border border-alt" onClick={this.handleDeclineAll}>
									Rechazar
								</adc-button>
								<adc-button class="px-4 py-2 text-sm rounded-xxl text-primary border border-alt" onClick={this.handleAcceptAnalytics}>
									Aceptar analítica
								</adc-button>
								<adc-button class="px-4 py-2 text-sm rounded-xxl text-primary" onClick={this.handleAcceptAll}>
									Aceptar todo
								</adc-button>
							</div>
						</div>
					) : (
						<div>
							<p class="text-sm leading-relaxed">
								Usamos analítica (GA4) y medición (Clarity) para mejorar el sitio. La analítica está habilitada; podés desactivarla o
								cerrar este aviso. Ver{" "}
								<a href={this.privacyHref} class="underline hover:no-underline">
									Privacidad
								</a>{" "}
								y{" "}
								<a href={this.cookiesHref} class="underline hover:no-underline">
									Cookies
								</a>
								.
							</p>
							<div class="mt-3 flex flex-wrap gap-2 justify-end">
								<adc-button class="px-4 py-2 text-sm rounded-xxl text-primary border border-alt" onClick={this.handleDeclineAnalytics}>
									Desactivar analítica
								</adc-button>
								<adc-button class="px-4 py-2 text-sm rounded-xxl text-primary border border-alt" onClick={this.handleAcknowledge}>
									Entendido
								</adc-button>
							</div>
						</div>
					)}
				</div>
			</dialog>
		);
	}
}
