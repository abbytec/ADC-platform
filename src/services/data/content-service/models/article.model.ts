import { Schema } from "mongoose";
import type { Article, Block } from "../../../../common/ADC/types/learning.js";

const BlockSchema = new Schema<Block>({}, { strict: false, _id: false });

export const ArticleSchema = new Schema<Article>(
	{
		slug: { type: String, required: true, unique: true, index: true },
		title: { type: String, required: true },
		pathSlug: { type: String, ref: "LearningPath", index: true },
		blocks: { type: [BlockSchema], default: undefined },
		videoUrl: String,
		image: {
			url: String,
			width: Number,
			height: Number,
			alt: String,
		},
		authorId: { type: String, required: true },
		listed: { type: Boolean, default: true, index: true },
		description: String,
	},
	{
		timestamps: true,
		collection: "articles",
	}
);
