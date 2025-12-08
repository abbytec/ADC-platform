import { Component, Prop, h } from "@stencil/core";

@Component({
	tag: "adc-quote",
	shadow: false,
})
export class AdcQuote {
	@Prop() staticRender: boolean = true;

	render() {
		return (
			<blockquote class="border-l-4 border-accent pl-4 italic text-text my-3 text-left">
				<slot></slot>
			</blockquote>
		);
	}
}
