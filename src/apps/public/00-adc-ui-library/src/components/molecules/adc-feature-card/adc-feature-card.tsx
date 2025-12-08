import { Component, Prop, h } from "@stencil/core";

@Component({
	tag: "adc-feature-card",
	shadow: false,
})
export class AdcFeatureCard {
	@Prop() title: string = "";
	@Prop() staticRender: boolean = true;

	render() {
		return (
			<article class="bg-alt rounded-xxl p-4 shadow-cozy text-center flex flex-col items-center w-full max-w-[480px] mx-auto">
				<div class="mb-2" aria-hidden="true">
					<slot name="icon"></slot>
				</div>
				<h3>{this.title}</h3>
				<adc-text>
					<slot></slot>
				</adc-text>
			</article>
		);
	}
}
