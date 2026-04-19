import { Component, Prop, h, Event, EventEmitter } from "@stencil/core";
import type { CommentEntry } from "../../atoms/adc-comment-item/adc-comment-item";

export interface SessionLike {
	authenticated: boolean;
	userId?: string;
	canComment?: boolean;
	canModerate?: boolean;
}

@Component({
	tag: "adc-comments-section",
	shadow: false,
})
export class AdcCommentsSection {
	@Prop() comments: CommentEntry[] = [];
	@Prop() session: SessionLike = { authenticated: false };
	@Prop() submitting: boolean = false;
	@Prop() loading: boolean = false;
	@Prop() articleAuthorId?: string;
	@Prop() discordUrl: string = "https://discord.gg/vShXpyWTTq";

	@Event() adcSubmit!: EventEmitter<string>;
	@Event() adcDelete!: EventEmitter<string>;

	private canDeleteComment(comment: CommentEntry): boolean {
		if (!this.session.authenticated || !this.session.userId) return false;
		if (this.session.canModerate) return true;
		if (comment.authorId === this.session.userId) return true;
		if (this.articleAuthorId && this.articleAuthorId === this.session.userId) return true;
		return false;
	}

	private renderForm() {
		if (!this.session.authenticated || !this.session.canComment) return null;
		return (
			<adc-comment-form
				submitting={this.submitting}
				onAdcSubmit={(ev: CustomEvent<string>) => {
					ev.stopPropagation();
					this.adcSubmit.emit(ev.detail);
				}}
			/>
		);
	}

	render() {
		return (
			<section class="flex flex-col gap-4" aria-label="Comentarios">
				{this.renderForm()}
				{this.loading ? (
					<p class="text-muted text-center">Cargando comentarios...</p>
				) : this.comments.length === 0 ? (
					<p class="text-muted text-center">Aún no hay comentarios.</p>
				) : (
					<ul class="flex flex-col gap-2 list-none p-0">
						{this.comments.map((c) => (
							<adc-comment-item
								key={c._id || `${c.authorId}-${c.createdAt}`}
								comment={c}
								canDelete={this.canDeleteComment(c)}
								onAdcDelete={(ev: CustomEvent<string>) => {
									ev.stopPropagation();
									this.adcDelete.emit(ev.detail);
								}}
							/>
						))}
					</ul>
				)}
			</section>
		);
	}
}
