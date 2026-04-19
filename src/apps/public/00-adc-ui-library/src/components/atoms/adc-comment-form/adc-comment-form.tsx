import { Component, Prop, h, Event, EventEmitter, State } from "@stencil/core";

const MAX_LENGTH = 2000;

@Component({
	tag: "adc-comment-form",
	shadow: false,
})
export class AdcCommentForm {
	@Prop() submitting: boolean = false;
	@Prop() placeholder: string = "Escribe un comentario...";

	@State() value: string = "";

	@Event() adcSubmit!: EventEmitter<string>;

	private handleInput = (ev: Event) => {
		const target = ev.target as HTMLTextAreaElement;
		this.value = target.value.slice(0, MAX_LENGTH);
	};

	private handleSubmit = (ev: Event) => {
		ev.preventDefault();
		const trimmed = this.value.trim();
		if (!trimmed || this.submitting) return;
		this.adcSubmit.emit(trimmed);
		this.value = "";
	};

	render() {
		const remaining = MAX_LENGTH - this.value.length;
		const disabled = !this.value.trim() || this.submitting;
		return (
			<form onSubmit={this.handleSubmit} class="flex flex-col gap-2 bg-surface rounded-xxl p-4 shadow-cozy">
				<label class="sr-only" htmlFor="adc-comment-textarea">
					Comentario
				</label>
				<textarea
					id="adc-comment-textarea"
					value={this.value}
					placeholder={this.placeholder}
					maxLength={MAX_LENGTH}
					rows={3}
					class="w-full p-2 rounded-xxl border border-alt bg-background text-text resize-y"
					onInput={this.handleInput}
					aria-describedby="adc-comment-counter"
				/>
				<div class="flex items-center justify-between gap-2">
					<small id="adc-comment-counter" class={`text-sm ${remaining < 100 ? "text-tdanger" : "text-muted"}`}>
						{remaining} caracteres
					</small>
					<adc-button type="submit" disabled={disabled} label={this.submitting ? "Publicando..." : "Comentar"} />
				</div>
			</form>
		);
	}
}
