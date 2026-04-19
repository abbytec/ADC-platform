import type { Model } from "mongoose";
import type { Comment } from "../../../../common/ADC/types/community.js";
import type { Article } from "../../../../common/ADC/types/learning.js";
import { COMMENT_MAX_LENGTH, COMMENT_MIN_LENGTH } from "../../../../common/ADC/types/community.js";
import { RegisterEndpoint, type EndpointCtx } from "../../../core/EndpointManagerService/index.js";
import { HttpError } from "@common/types/ADCCustomError.ts";
import { P } from "@common/types/Permissions.ts";

interface SlugParams {
	slug: string;
}

interface SlugIdParams {
	slug: string;
	id: string;
}

interface CreateCommentBody {
	content?: unknown;
}

const HEX24 = /^[0-9a-f]{24}$/i;

function sanitizeContent(raw: unknown): string {
	if (typeof raw !== "string") throw new HttpError(400, "INVALID_CONTENT", "content must be a string");
	const trimmed = raw.trim();
	if (trimmed.length < COMMENT_MIN_LENGTH) throw new HttpError(400, "EMPTY_CONTENT", "Comment cannot be empty");
	if (trimmed.length > COMMENT_MAX_LENGTH) throw new HttpError(400, "CONTENT_TOO_LONG", `Comment exceeds ${COMMENT_MAX_LENGTH} chars`);
	return trimmed;
}

export class CommentEndpoints {
	private static model: Model<Comment>;
	private static articleModel: Model<Article>;

	static init(model: Model<any>, articleModel: Model<any>) {
		CommentEndpoints.model ??= model;
		CommentEndpoints.articleModel ??= articleModel;
	}

	@RegisterEndpoint({ method: "GET", url: "/api/learning/articles/:slug/comments" })
	static async list(ctx: EndpointCtx<SlugParams>): Promise<{ comments: Comment[] }> {
		const { slug } = ctx.params;
		const docs = await CommentEndpoints.model.find({ articleSlug: slug }).sort({ createdAt: 1 }).limit(500).lean();
		return { comments: docs as Comment[] };
	}

	@RegisterEndpoint({
		method: "POST",
		url: "/api/learning/articles/:slug/comments",
		permissions: [P.COMMUNITY.SOCIAL.WRITE],
		options: { rateLimit: { max: 5, timeWindow: "1 minute" } },
	})
	static async create(ctx: EndpointCtx<SlugParams, CreateCommentBody>): Promise<{ comment: Comment }> {
		const { slug } = ctx.params;
		const user = ctx.user;
		if (!user) throw new HttpError(401, "UNAUTHENTICATED", "Authentication required");

		const article = await CommentEndpoints.articleModel.findOne({ slug, listed: true }).select("slug listed").lean();
		if (!article) throw new HttpError(404, "ARTICLE_NOT_FOUND", "Article not found or not published");

		const content = sanitizeContent(ctx.data?.content);

		const doc = await CommentEndpoints.model.create({
			articleSlug: slug,
			authorId: user.id,
			authorName: user.username,
			authorImage: (user.metadata?.avatar as string) || undefined,
			content,
		});

		return { comment: doc.toObject() as Comment };
	}

	@RegisterEndpoint({
		method: "DELETE",
		url: "/api/learning/articles/:slug/comments/:id",
		permissions: [P.COMMUNITY.SOCIAL.WRITE],
	})
	static async remove(ctx: EndpointCtx<SlugIdParams>): Promise<{ success: boolean }> {
		const { slug, id } = ctx.params;
		const user = ctx.user;
		if (!user) throw new HttpError(401, "UNAUTHENTICATED", "Authentication required");
		if (!HEX24.test(id)) throw new HttpError(400, "INVALID_ID", "Invalid comment id");

		const comment = await CommentEndpoints.model.findOne({ _id: id, articleSlug: slug }).select("authorId").lean();
		if (!comment) throw new HttpError(404, "COMMENT_NOT_FOUND", "Comment not found");

		const isOwner = comment.authorId === user.id;
		const isModerator = (user.permissions || []).some((p) => p === P.COMMUNITY.SOCIAL.DELETE || p === P.COMMUNITY.SOCIAL.ALL);

		if (!isOwner && !isModerator) {
			const article = await CommentEndpoints.articleModel.findOne({ slug }).select("authorId").lean();
			if (article?.authorId !== user.id) throw new HttpError(403, "FORBIDDEN", "Not allowed to delete this comment");
		}

		await CommentEndpoints.model.deleteOne({ _id: id, articleSlug: slug });
		return { success: true };
	}
}
