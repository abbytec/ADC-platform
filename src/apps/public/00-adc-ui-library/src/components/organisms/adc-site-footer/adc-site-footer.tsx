import { Component, Prop, h } from "@stencil/core";

@Component({
	tag: "adc-site-footer",
	shadow: false,
})
export class AdcSiteFooter {
	@Prop() brandName: string = "";
	@Prop() brandSlogan: string = "";
	@Prop() creatorName: string = "";
	@Prop() creatorHref: string = "";

	private getYear(): number {
		return new Date().getFullYear();
	}

	render() {
		return (
			<footer class="py-4 text-center opacity-80 border-t border-gray-200 flex-shrink-0 min-h-24 cv-auto ">
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
				<slot></slot>
			</footer>
		);
	}
}
