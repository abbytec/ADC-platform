import { BaseOAuthProvider } from "./base.js";
import type { ProviderUserProfile } from "../../types.js";

/**
 * Proveedor OAuth para Discord
 */
export class DiscordOAuthProvider extends BaseOAuthProvider {
	readonly name = "discord";

	protected readonly authorizationEndpoint = "https://discord.com/api/oauth2/authorize";
	protected readonly tokenEndpoint = "https://discord.com/api/oauth2/token";
	protected readonly userInfoEndpoint = "https://discord.com/api/users/@me";

	protected getAdditionalAuthParams(): Record<string, string> {
		return {
			prompt: "consent",
		};
	}

	protected parseUserProfile(data: any): ProviderUserProfile {
		// Discord avatar URL format
		let avatar: string | undefined;
		if (data.avatar) {
			const ext = data.avatar.startsWith("a_") ? "gif" : "png";
			avatar = `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.${ext}`;
		}

		return {
			id: data.id,
			username: data.username,
			email: data.email,
			avatar,
			raw: data,
		};
	}
}
