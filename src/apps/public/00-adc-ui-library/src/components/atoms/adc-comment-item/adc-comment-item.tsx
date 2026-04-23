import { Component, Prop, h, Fragment, Event, EventEmitter, State } from "@stencil/core";

export interface CommentEntry {
	_id?: string;
	authorId: string;
	authorName?: string;
	authorImage?: string;
	content: string;
	createdAt?: string;
}

@Component({
	tag: "adc-comment-item",
	shadow: false,
})
export class AdcCommentItem {
	@Prop() comment!: CommentEntry;
	@Prop() canDelete: boolean = false;

	@Event() adcDelete!: EventEmitter<string>;

	@State() confirming: boolean = false;

	private readonly requestDelete = () => {
		this.confirming = true;
	};

	private readonly confirmDelete = () => {
		if (this.comment._id) this.adcDelete.emit(this.comment._id);
		this.confirming = false;
	};

	private readonly cancelDelete = () => {
		this.confirming = false;
	};

	render() {
		const c = this.comment;
		const date = c.createdAt ? new Date(c.createdAt).toLocaleString() : "";
		return (
			<li class="flex gap-3 p-3 bg-surface rounded-xxl shadow-cozy">
				{c.authorImage ? (
					<img src={c.authorImage} alt={c.authorName || "Avatar"} class="w-10 h-10 rounded-full object-cover shrink-0" />
				) : (
					<div class="w-10 h-10 rounded-full bg-alt shrink-0" aria-hidden="true" />
				)}
				<div class="flex-1 min-w-0">
					<div class="flex items-baseline gap-2 flex-wrap">
						<span class="font-semibold text-text">{c.authorName || c.authorId}</span>
						<small class="text-muted">{date}</small>
					</div>
					<p class="text-text whitespace-pre-wrap wrap-break-word mt-1">{c.content}</p>
				</div>
				{this.canDelete && c._id ? (
					<div class="flex items-center gap-1">
						{this.confirming ? (
							<>
								<button
									type="button"
									class="text-tdanger text-sm px-2"
									onClick={this.confirmDelete}
									aria-label="Confirmar borrado"
								>
									Eliminar
								</button>
								<button type="button" class="text-muted text-sm px-2" onClick={this.cancelDelete} aria-label="Cancelar">
									Cancelar
								</button>
							</>
						) : (
							<button
								type="button"
								class="text-muted hover:text-tdanger text-sm px-2"
								onClick={this.requestDelete}
								aria-label="Eliminar comentario"
								title="Eliminar"
							>
								✕
							</button>
						)}
					</div>
				) : null}
			</li>
		);
	}
}
