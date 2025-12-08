import { Component, h } from "@stencil/core";

@Component({
	tag: "adc-divider",
	shadow: false,
})
export class AdcDivider {
	render() {
		return <hr class="my-4 border-alt my-2" aria-label="Separador" />;
	}
}
