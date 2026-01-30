import ADCCustomError, { type ADCCustomErrorJSON } from "../ADCCustomError.ts";
type AuthErrorData = { blockedUntil?: number; permanent?: boolean; requireRelogin?: boolean };

type ExcpectedAuthErrorTypes =
	// AUTH FLOW
	| "ACCOUNT_BLOCKED"
	| "MISSING_FIELDS"
	| "INVALID_USERNAME"
	| "WEAK_PASSWORD"
	| "INVALID_EMAIL"
	| "USERNAME_EXISTS"
	| "EMAIL_EXISTS"
	// GENERIC
	| "MISSING_CREDENTIALS"
	| "INVALID_CREDENTIALS"
	| "NO_SESSION"
	| "INVALID_SESSION"
	| "NO_REFRESH_TOKEN"
	| "INVALID_REFRESH_TOKEN"
	| "LOCATION_CHANGE";

type UnexpectedAuthErrorTypes =
	// AUTH FLOW
	| "REGISTER_ERROR"
	| "AUTH_UNAVAILABLE"
	| "SERVICE_UNAVAILABLE"
	| "PROVIDER_NOT_SUPPORTED"
	| "PROVIDER_CONFIG_NOT_FOUND"
	| "AUTH_ERROR"
	// GENERIC
	| "REFRESH_FAILED";

export type AuthErrorTypes = UnexpectedAuthErrorTypes | ExcpectedAuthErrorTypes;

export class AuthError extends ADCCustomError<AuthErrorData, AuthErrorTypes> {
	public readonly name = "AuthError";
}

export type ADCAuthErrorJSON = ADCCustomErrorJSON<AuthErrorData, AuthErrorTypes>;
