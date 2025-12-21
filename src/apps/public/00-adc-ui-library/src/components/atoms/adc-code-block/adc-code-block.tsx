import { Component, Prop, h } from "@stencil/core";

@Component({
	tag: "adc-code-block",
	shadow: false,
})
export class AdcCodeBlock {
	@Prop() language?: string;
	@Prop() content: string = "";
	@Prop() ariaLabel?: string;

	private escapeHtml(text: string): string {
		return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	}

	render() {
		const escapedContent = this.escapeHtml(this.content);
		const codeClass = this.language
			? `block p-3 whitespace-pre break-normal language-${this.language} lang-${this.language}`
			: "block p-3 whitespace-pre break-normal";

		return (
			<figure
				class="bg-surface rounded-xxl px-6 pb-2 pt-4 ml-8 overflow-x-auto text-md mb-2 font-mono break-normal xl:max-w-[80vw]"
				aria-label={this.ariaLabel}
			>
				{this.language && <figcaption class="text-blue-800">[{this.language}]</figcaption>}
				<code class={codeClass} innerHTML={escapedContent}></code>
			</figure>
		);
	}
}
