import { createAdcApi } from "@ui-library/utils/adc-fetch";

/**
 * Cliente dedicado para endpoints de identity usados desde adc-auth
 * (ej. validación de disponibilidad de username en el registro).
 */
const api = createAdcApi({
	basePath: "/api/identity",
	devPort: 3000,
	credentials: process.env.NODE_ENV === "development" ? "include" : "same-origin",
});

export const identityApi = {
	/**
	 * Verificar si un username ya existe (endpoint de identity).
	 */
	checkUsernameExists: (username: string, signal?: AbortSignal) => api.head(`/users/username/${encodeURIComponent(username)}`, { signal }),
};
