import { UserAuthenticationResult } from "../../../../core/IdentityManagerService/dao/users.ts";
import { BaseOAuthProvider } from "./base.js";

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

	protected parseUserProfile(data: Record<string, any>): UserAuthenticationResult {
		return {
			id: data.id,
			username: data.name || data.email?.split("@")[0] || "user",
			email: data.email,
			avatar: data.picture,
			metadata: data,
		};
	}
}
