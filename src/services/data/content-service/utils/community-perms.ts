import { P, hasPermission } from "@common/types/Permissions.ts";

interface UserLike {
	id?: string;
	permissions?: string[];
}

/** El usuario puede modificar el estado de publicación (listed/description). */
export function canPublish(user: UserLike | null | undefined): boolean {
	if (!user?.permissions) return false;
	return hasPermission(user.permissions, P.COMMUNITY.PUBLISH_STATUS.WRITE);
}

/** El usuario puede moderar (eliminar) contenido social ajeno. */
export function canModerateSocial(user: UserLike | null | undefined): boolean {
	if (!user?.permissions) return false;
	return hasPermission(user.permissions, P.COMMUNITY.SOCIAL.DELETE);
}

/** Devuelve true si user es dueño del recurso (authorId match). */
export function isOwner(user: UserLike | null | undefined, authorId: string | undefined | null): boolean {
	if (!user?.id || !authorId) return false;
	return user.id === authorId;
}
