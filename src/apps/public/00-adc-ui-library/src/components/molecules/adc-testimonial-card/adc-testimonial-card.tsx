import { Component, Prop, h } from "@stencil/core";

@Component({
	tag: "adc-testimonial-card",
	shadow: false,
})
export class AdcTestimonialCard {
	@Prop() author: string = "";
	@Prop() staticRender: boolean = true;

	render() {
		return (
			<blockquote class="bg-alt rounded-xxl p-4 shadow-cozy w-full max-w-[480px] mx-auto">
				<adc-text class="italic">
					<slot></slot>
				</adc-text>
				<footer class="mt-2 font-heading p-text">— {this.author}</footer>
			</blockquote>
		);
	}
}
