import { Schema, type Document } from "mongoose";

export interface IArticle extends Document {
	slug: string;
	title: string;
	pathSlug?: string;
	blocks?: any[];
	videoUrl?: string;
	image?: {
		url: string;
		width?: number;
		height?: number;
		alt?: string;
	};
	authorId: string;
	listed: boolean;
	description?: string;
	createdAt: Date;
	updatedAt: Date;
}

export const ArticleSchema = new Schema<IArticle>(
	{
		slug: { type: String, required: true, unique: true, index: true },
		title: { type: String, required: true },
		pathSlug: { type: String, ref: "LearningPath", index: true },
		blocks: { type: [Schema.Types.Mixed], default: undefined },
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
