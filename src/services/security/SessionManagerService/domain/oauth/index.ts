export { BaseOAuthProvider } from "./base.js";
export { DiscordOAuthProvider } from "./discord.js";
export { GoogleOAuthProvider } from "./google.js";
export { PlatformAuthProvider } from "./platform.js";

import type { IOAuthProvider } from "../../types.js";
import { DiscordOAuthProvider } from "./discord.js";
import { GoogleOAuthProvider } from "./google.js";

/**
 * Registry de proveedores OAuth disponibles
 */
export class OAuthProviderRegistry {
	#providers = new Map<string, IOAuthProvider>();

	constructor() {
		// Registrar providers por defecto
		this.register(new DiscordOAuthProvider());
		this.register(new GoogleOAuthProvider());
	}

	/**
	 * Registra un nuevo proveedor OAuth
	 */
	register(provider: IOAuthProvider): void {
		this.#providers.set(provider.name, provider);
	}

	/**
	 * Obtiene un proveedor por nombre
	 */
	get(name: string): IOAuthProvider | undefined {
		return this.#providers.get(name);
	}

	/**
	 * Lista los proveedores disponibles
	 */
	list(): string[] {
		return Array.from(this.#providers.keys());
	}

	/**
	 * Verifica si un proveedor existe
	 */
	has(name: string): boolean {
		return this.#providers.has(name);
	}
}
