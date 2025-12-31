import { Component, Prop, h } from "@stencil/core";

export interface Block {
	type: "heading" | "paragraph" | "list" | "code" | "callout" | "quote" | "table" | "divider";
	level?: number;
	id?: string;
	align?: "left" | "center" | "right";
	text?: string;
	marks?: Array<"bold" | "italic" | "code">;
	ordered?: boolean;
	items?: string[];
	start?: number;
	ariaLabel?: string;
	language?: string;
	content?: string;
	tone?: "info" | "warning" | "success" | "error";
	role?: "note" | "status" | "alert";
	url?: string;
	rel?: string[];
	header?: string[];
	rows?: string[][];
	columnAlign?: Array<"left" | "center" | "right">;
	caption?: string;
	rowHeaders?: boolean;
}

@Component({
	tag: "adc-blocks-renderer",
	shadow: false,
})
export class AdcBlocksRenderer {
	@Prop() blocks: Block[] = [];

	private getAlignClass(align?: "left" | "center" | "right"): string {
		if (align === "center") return "text-center";
		if (align === "right") return "text-right";
		return "";
	}

	private getMarksClass(marks?: Array<"bold" | "italic" | "code">): string {
		const classes: string[] = [];
		if (marks?.includes("bold")) classes.push("font-bold");
		if (marks?.includes("italic")) classes.push("italic");
		return classes.join(" ");
	}

	private renderBlock(block: Block, index: number) {
		switch (block.type) {
			case "heading":
				return this.renderHeading(block, index);
			case "paragraph":
				return this.renderParagraph(block, index);
			case "list":
				return (
					<adc-list-block
						key={index}
						ordered={block.ordered}
						items={block.items || []}
						start={block.start}
						ariaLabel={block.ariaLabel}
					></adc-list-block>
				);
			case "code":
				return (
					<adc-code-block
						key={index}
						language={block.language}
						content={block.content || ""}
						ariaLabel={block.ariaLabel}
					></adc-code-block>
				);
			case "callout":
				return (
					<adc-callout key={index} tone={block.tone} role={block.role}>
						<adc-inline-tokens tokens={[]} fallback={block.text || ""}></adc-inline-tokens>
					</adc-callout>
				);
			case "quote":
				return (
					<adc-quote key={index}>
						<adc-inline-tokens tokens={[]} fallback={block.text || ""}></adc-inline-tokens>
						{block.url && (
							<cite class="not-italic block mt-2 text-sm text-text opacity-80">
								<a
									href={block.url}
									target="_blank"
									rel={(block.rel || ["noopener", "noreferrer"]).join(" ")}
									aria-label={block.text}
									class="underline underline-offset-2 hover:no-underline"
								>
									Fuente
								</a>
							</cite>
						)}
					</adc-quote>
				);
			case "table":
				return (
					<adc-table-block
						key={index}
						header={block.header || []}
						rows={block.rows || []}
						columnAlign={block.columnAlign}
						caption={block.caption}
						rowHeaders={block.rowHeaders}
					></adc-table-block>
				);
			case "divider":
				return <adc-divider key={index}></adc-divider>;
			default:
				return null;
		}
	}

	private renderHeading(block: Block, index: number) {
		const alignClass = this.getAlignClass(block.align);
		const level = block.level || 2;
		const Tag = `h${level}` as "h2" | "h3" | "h4" | "h5" | "h6";

		return (
			<Tag key={index} id={block.id} class={alignClass}>
				{block.text}
			</Tag>
		);
	}

	private renderParagraph(block: Block, index: number) {
		const classes = `${this.getAlignClass(block.align)} ${this.getMarksClass(block.marks)} pl-4 pr-16 whitespace-pre-line`;

		if (block.marks?.includes("code")) {
			return (
				<adc-text key={index} class={classes}>
					<code>{block.text}</code>
				</adc-text>
			);
		}

		return (
			<adc-text key={index} class={classes}>
				<adc-inline-tokens tokens={[]} fallback={block.text || ""}></adc-inline-tokens>
			</adc-text>
		);
	}

	render() {
		return <div>{this.blocks.map((block, index) => this.renderBlock(block, index))}</div>;
	}
}
