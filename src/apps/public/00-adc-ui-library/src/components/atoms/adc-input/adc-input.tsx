import { Component, Prop, h } from "@stencil/core";

@Component({
	tag: "adc-input",
	shadow: false,
})
export class AdcInput {
	@Prop() value: string = "";
	@Prop() placeholder?: string = "";
	@Prop() inputId?: string = "";
	@Prop() name?: string = "";
	@Prop() type?: string = "text";
	@Prop() autocomplete?: string = "off";
	@Prop() ariaLabel?: string = "";

	render() {
		return (
			<input
				id={this.inputId}
				value={this.value}
				placeholder={this.placeholder}
				name={this.name}
				type={this.type}
				autocomplete={this.autocomplete}
				aria-label={this.ariaLabel || this.placeholder || this.name}
				class="w-full px-3 py-2 rounded-xxl border border-surface bg-white font-text text-[12px] text-black"
			/>
		);
	}
}
