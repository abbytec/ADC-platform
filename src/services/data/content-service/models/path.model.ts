import { Schema, type Document } from "mongoose";

export interface ILearningPathItem {
	slug: string;
	type: "article" | "path";
	level: "critico" | "importante" | "opcional";
}

export interface ILearningPath extends Document {
	slug: string;
	title: string;
	description: string;
	color: string;
	banner?: {
		url: string;
		width?: number;
		height?: number;
		alt?: string;
	};
	public: boolean;
	listed: boolean;
	items: ILearningPathItem[];
	createdAt: Date;
	updatedAt: Date;
}

export const LearningPathSchema = new Schema<ILearningPath>(
	{
		slug: { type: String, required: true, unique: true, index: true },
		title: { type: String, required: true },
		description: { type: String, required: true },
		color: { type: String, required: true },
		banner: {
			url: String,
			width: Number,
			height: Number,
			alt: String,
		},
		public: { type: Boolean, default: true, index: true },
		listed: { type: Boolean, default: true, index: true },
		items: [
			{
				slug: { type: String, required: true },
				type: { type: String, enum: ["article", "path"], required: true },
				level: { type: String, enum: ["critico", "importante", "opcional"] },
			},
		],
	},
	{
		timestamps: true,
		collection: "learningpaths",
	}
);
