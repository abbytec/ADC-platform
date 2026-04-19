import type { Model, PipelineStage } from "mongoose";
import type { Rating, RatingStats } from "../../../../common/ADC/types/community.js";
import type { Article } from "../../../../common/ADC/types/learning.js";
import { RATING_MIN, RATING_MAX } from "../../../../common/ADC/types/community.js";
import { RegisterEndpoint, type EndpointCtx } from "../../../core/EndpointManagerService/index.js";
import { HttpError } from "@common/types/ADCCustomError.ts";
import { P } from "@common/types/Permissions.ts";

interface SlugParams {
	slug: string;
}

interface RateBody {
	value?: unknown;
}

function parseRatingValue(raw: unknown): number {
	const n = Number(raw);
	if (!Number.isFinite(n)) throw new HttpError(400, "INVALID_RATING", "value must be a number");
	const clamped = Math.max(RATING_MIN, Math.min(RATING_MAX, Math.round(n)));
	return clamped;
}

export class RatingEndpoints {
	private static model: Model<Rating>;
	private static articleModel: Model<Article>;

	static init(model: Model<any>, articleModel: Model<any>) {
		RatingEndpoints.model ??= model;
		RatingEndpoints.articleModel ??= articleModel;
	}

	@RegisterEndpoint({ method: "GET", url: "/api/learning/articles/:slug/rating" })
	static async get(ctx: EndpointCtx<SlugParams>): Promise<RatingStats> {
		const { slug } = ctx.params;
		const userId = ctx.user?.id;

		const pipeline: PipelineStage[] = [
			{ $match: { articleSlug: slug } },
			{ $group: { _id: null, avg: { $avg: "$value" }, count: { $sum: 1 } } },
		];

		const [stats, mine] = await Promise.all([
			RatingEndpoints.model.aggregate(pipeline),
			userId ? RatingEndpoints.model.findOne({ articleSlug: slug, userId }).select("value").lean() : null,
		]);

		return {
			average: stats[0]?.avg ?? 0,
			count: stats[0]?.count ?? 0,
			myRating: mine?.value ?? null,
		};
	}

	@RegisterEndpoint({
		method: "POST",
		url: "/api/learning/articles/:slug/rating",
		permissions: [P.COMMUNITY.SOCIAL.WRITE],
		options: { skipIdempotency: true, rateLimit: { max: 5, timeWindow: 60_000 } },
	})
	static async rate(ctx: EndpointCtx<SlugParams, RateBody>): Promise<{ success: boolean }> {
		const { slug } = ctx.params;
		const user = ctx.user;
		if (!user) throw new HttpError(401, "UNAUTHENTICATED", "Authentication required");

		const article = await RatingEndpoints.articleModel.findOne({ slug, listed: true }).select("slug").lean();
		if (!article) throw new HttpError(404, "ARTICLE_NOT_FOUND", "Article not found or not published");

		const value = Number(ctx.data?.value);

		if (value === 0) {
			await RatingEndpoints.model.deleteOne({ articleSlug: slug, userId: user.id });
		} else {
			const clamped = parseRatingValue(value);
			await RatingEndpoints.model.findOneAndUpdate(
				{ articleSlug: slug, userId: user.id },
				{ $set: { value: clamped } },
				{ upsert: true, new: true }
			);
		}

		return { success: true };
	}
}
