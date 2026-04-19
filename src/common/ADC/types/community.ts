/**
 * Tipos para interacción social en Community (comentarios, ratings).
 * Fuente única de verdad para backend y frontend.
 */

export interface Comment {
	_id?: string;
	articleSlug: string;
	authorId: string;
	authorName?: string;
	authorImage?: string;
	content: string;
	createdAt?: string;
	updatedAt?: string;
}

export interface Rating {
	articleSlug: string;
	userId: string;
	value: 1 | 2 | 3 | 4 | 5;
	createdAt?: string;
	updatedAt?: string;
}

export interface RatingStats {
	average: number;
	count: number;
	myRating: number | null;
}

/** Límites de tamaño/seguridad para inputs sociales */
export const COMMENT_MAX_LENGTH = 2000;
export const COMMENT_MIN_LENGTH = 1;
export const RATING_MIN = 1;
export const RATING_MAX = 5;
