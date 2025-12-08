import { Component, Prop, h, Event, EventEmitter } from "@stencil/core";

@Component({
	tag: "adc-site-footer",
	shadow: false,
})
export class AdcSiteFooter {
	@Prop() brandName: string = "";
	@Prop() brandSlogan: string = "";
	@Prop() creatorName: string = "";
	@Prop() creatorHref: string = "";

	@Event() adcOpenPrivacyPreferences!: EventEmitter<void>;

	private getYear(): number {
		return new Date().getFullYear();
	}

	private handlePrivacyClick = () => {
		this.adcOpenPrivacyPreferences.emit();
	};

	render() {
		return (
			<footer class="py-4 text-center opacity-80 border-t flex-shrink-0 min-h-24 cv-auto">
				<adc-text>
					&copy; {this.getYear()} {this.brandName} - {this.brandSlogan} · creada por{" "}
					<a
						href={this.creatorHref}
						target="_blank"
						rel="noopener noreferrer"
						aria-label={`Sitio de ${this.creatorName} (se abre en una pestaña nueva)`}
					>
						{this.creatorName}
						<span class="sr-only"> (se abre en una pestaña nueva)</span>
					</a>
				</adc-text>

				<div class="mt-2 text-sm">
					<slot></slot>
					<span aria-hidden="true" class="mx-1">·</span>
					<button
						type="button"
						class="underline hover:no-underline !bg-transparent !text-text"
						onClick={this.handlePrivacyClick}
					>
						Preferencias de privacidad
					</button>
				</div>
			</footer>
		);
	}
}
