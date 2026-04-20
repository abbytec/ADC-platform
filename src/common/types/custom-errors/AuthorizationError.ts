import ADCCustomError from "../ADCCustomError.ts";

export type AuthorizationErrorCode = "NO_TOKEN" | "INVALID_TOKEN" | "INSUFFICIENT_PERMISSIONS";

const AUTH_STATUS_MAP: Record<AuthorizationErrorCode, number> = {
	NO_TOKEN: 401,
	INVALID_TOKEN: 401,
	INSUFFICIENT_PERMISSIONS: 403,
};

export class AuthorizationError extends ADCCustomError<Record<string, unknown>, AuthorizationErrorCode> {
	public readonly name = "AuthorizationError";

	constructor(message: string, code: AuthorizationErrorCode = "INSUFFICIENT_PERMISSIONS") {
		super(AUTH_STATUS_MAP[code], code, message);
	}
}
