import { Schema } from "mongoose";
import { LearningPath } from "../../../../common/ADC/gen/learning/learning_pb.ts";

export const LearningPathSchema = new Schema<LearningPath>(
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
