import { Component, Prop, Element, h } from "@stencil/core";

@Component({
	tag: "adc-quote",
	shadow: false,
})
export class AdcQuote {
	@Element() el!: HTMLElement;
	@Prop() staticRender: boolean = true;

	render() {
		// Captura las clases del host y aplícalas al blockquote interno
		const hostClass = this.el.className;
		return (
			<blockquote class={`border-l-4 border-accent pl-4 italic text-text my-3 text-left ${hostClass}`}>
				<slot></slot>
			</blockquote>
		);
	}
}
