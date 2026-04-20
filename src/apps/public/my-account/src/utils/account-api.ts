import { createAdcApi } from "@ui-library/utils/adc-fetch";
import type { ClientUser } from "@common/types/identity/User.ts";

const api = createAdcApi({
	basePath: "/api/identity",
	devPort: 3000,
	credentials: process.env.NODE_ENV === "development" ? "include" : "same-origin",
});

export interface UserProfileMetadata {
	name?: string;
	lastName?: string;
	birthDate?: string;
}

/** Idempotency helper */
function createIdempotencyKey(data: unknown, mode: "hash" | "uuid" = "hash") {
	if (mode === "uuid") return crypto.randomUUID();

	const str = JSON.stringify(data);
	let h = 5381;
	for (const ch of str) h = ((h << 5) + h + ch.codePointAt(0)!) >>> 0;
	return h.toString(36);
}

export const accountApi = {
	// USERS

	getUser: (userId: string) => api.get<ClientUser>(`/users/${userId}`),

	getCurrentUser: () => api.get<ClientUser>("/users/me"),

	updateUser: (userId: string, data: Partial<ClientUser>) =>
		api.put<ClientUser>(`/users/${userId}`, { body: data, idempotencyKey: createIdempotencyKey(data) }),

	patchUser: (userId: string, data: Partial<ClientUser>) =>
		api.patch<ClientUser>(`/users/${userId}`, { body: data, idempotencyKey: createIdempotencyKey(data) }),

	deleteUser: (userId: string) => api.delete(`/users/${userId}`, { idempotencyKey: userId }),

	patchCurrentUser: async (metadata: Partial<UserProfileMetadata>) => {
	const { data: user } = await api.get<ClientUser>("/users/me");

	if (!user) throw new Error("No se pudo obtener el usuario autenticado");

	return accountApi.patchUser(user.id, {
		metadata: {
			...(user.metadata || {}),
			...metadata,
		},
	});
},

	deleteCurrentUser: async () => {
		const { data: user } = await api.get<ClientUser>("/users/me");

		if (!user) {
			throw new Error("No se pudo obtener el usuario autenticado");
		}

		return accountApi.deleteUser(user.id);
	},

	// AUTH / SECURITY

	changePassword: (currentPassword: string, newPassword: string) => {
		return api.post("/users/change-password", {
			body: { currentPassword, newPassword },
			idempotencyKey: crypto.randomUUID(),
		});
	},
};
