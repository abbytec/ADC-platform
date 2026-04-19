import { Schema } from "mongoose";
import type { Comment } from "../../../../common/ADC/types/community.js";
import { COMMENT_MAX_LENGTH, COMMENT_MIN_LENGTH } from "../../../../common/ADC/types/community.js";

export const CommentSchema = new Schema<Comment>(
	{
		articleSlug: { type: String, required: true, index: true, maxlength: 200 },
		authorId: { type: String, required: true, index: true, maxlength: 64 },
		authorName: { type: String, maxlength: 64 },
		authorImage: { type: String, maxlength: 512 },
		content: { type: String, required: true, minlength: COMMENT_MIN_LENGTH, maxlength: COMMENT_MAX_LENGTH },
	},
	{
		timestamps: { createdAt: true, updatedAt: false },
		collection: "comments",
	}
);

CommentSchema.index({ articleSlug: 1, createdAt: 1 });
