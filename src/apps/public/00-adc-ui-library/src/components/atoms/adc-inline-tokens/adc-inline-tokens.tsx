import { Component, Prop, h } from "@stencil/core";

export interface InlineToken {
	type: "text" | "bold" | "italic" | "strike" | "code";
	content: string;
}

@Component({
	tag: "adc-inline-tokens",
	shadow: false,
})
export class AdcInlineTokens {
	@Prop() tokens: InlineToken[] = [];
	@Prop() fallback: string = "";

	render() {
		if (!this.tokens || this.tokens.length === 0) {
			return <span style={{ display: "contents" }}>{this.fallback}</span>;
		}

		return (
			<span style={{ display: "contents" }}>
				{this.tokens.map((token, idx) => {
					switch (token.type) {
						case "bold":
							return <strong key={idx}>{token.content}</strong>;
						case "italic":
							return <em key={idx}>{token.content}</em>;
						case "strike":
							return <s key={idx}>{token.content}</s>;
						case "code":
							return <code key={idx}>{token.content}</code>;
						default:
							return <span key={idx} style={{ display: "contents" }}>{token.content}</span>;
					}
				})}
			</span>
		);
	}
}
