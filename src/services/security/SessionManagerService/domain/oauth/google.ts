import { BaseOAuthProvider } from "./base.js";
import type { ProviderUserProfile } from "../../types.js";

/**
 * Proveedor OAuth para Google
 */
export class GoogleOAuthProvider extends BaseOAuthProvider {
	readonly name = "google";

	protected readonly authorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
	protected readonly tokenEndpoint = "https://oauth2.googleapis.com/token";
	protected readonly userInfoEndpoint = "https://www.googleapis.com/oauth2/v2/userinfo";

	protected getAdditionalAuthParams(): Record<string, string> {
		return {
			access_type: "offline",
			prompt: "consent",
		};
	}

	protected parseUserProfile(data: any): ProviderUserProfile {
		return {
			id: data.id,
			username: data.name || data.email?.split("@")[0] || "user",
			email: data.email,
			avatar: data.picture,
			raw: data,
		};
	}
}
