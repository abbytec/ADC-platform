import { createAdcApi } from "@ui-library/utils/adc-fetch";
import type { Comment, RatingStats } from "@common/ADC/types/community.js";

const api = createAdcApi({
	basePath: "/api/learning",
	devPort: 3000,
	credentials: "include",
});

export const socialApi = {
	listComments: async (slug: string): Promise<Comment[]> => {
		const r = await api.get<{ comments: Comment[] }>(`/articles/${slug}/comments`);
		return r.data?.comments ?? [];
	},
	createComment: async (slug: string, content: string): Promise<Comment | null> => {
		const r = await api.post<{ comment: Comment }>(`/articles/${slug}/comments`, {
			body: { content },
			idempotencyData: { slug, content },
		});
		return r.data?.comment ?? null;
	},
	deleteComment: async (slug: string, id: string): Promise<boolean> => {
		const r = await api.delete<{ success: boolean }>(`/articles/${slug}/comments/${id}`, {
			idempotencyKey: id,
		});
		return r.data?.success === true;
	},

	getRating: async (slug: string): Promise<RatingStats> => {
		const r = await api.get<RatingStats>(`/articles/${slug}/rating`);
		return r.data ?? { average: 0, count: 0, myRating: null };
	},
	rate: async (slug: string, value: number): Promise<boolean> => {
		const r = await api.post<{ success: boolean }>(`/articles/${slug}/rating`, {
			body: { value },
			idempotencyData: { slug, value },
		});
		return r.data?.success === true;
	},
};

export type { Comment, RatingStats };
