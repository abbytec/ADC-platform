import { Schema } from "mongoose";
import type { Rating } from "../../../../common/ADC/types/community.js";
import { RATING_MIN, RATING_MAX } from "../../../../common/ADC/types/community.js";

export const RatingSchema = new Schema<Rating>(
	{
		articleSlug: { type: String, required: true, index: true, maxlength: 200 },
		userId: { type: String, required: true, index: true, maxlength: 64 },
		value: { type: Number, required: true, min: RATING_MIN, max: RATING_MAX },
	},
	{
		timestamps: true,
		collection: "ratings",
	}
);

RatingSchema.index({ articleSlug: 1, userId: 1 }, { unique: true });
