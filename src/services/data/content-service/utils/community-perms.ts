import { P } from "@common/types/Permissions.ts";

export interface UserLike {
	id?: string;
	permissions?: string[];
}

/** El usuario puede modificar el estado de publicación (listed/description). */
export function canPublish(user: UserLike | null | undefined): boolean {
	if (!user?.permissions) return false;
	return user.permissions.some((p) => p === P.COMMUNITY.PUBLISH_STATUS.WRITE || p === P.COMMUNITY.PUBLISH_STATUS.ALL);
}

/** El usuario puede moderar (eliminar) contenido social ajeno. */
export function canModerateSocial(user: UserLike | null | undefined): boolean {
	if (!user?.permissions) return false;
	return user.permissions.some((p) => p === P.COMMUNITY.SOCIAL.DELETE || p === P.COMMUNITY.SOCIAL.ALL);
}

/** Devuelve true si user es dueño del recurso (authorId match). */
export function isOwner(user: UserLike | null | undefined, authorId: string | undefined | null): boolean {
	if (!user?.id || !authorId) return false;
	return user.id === authorId;
}
