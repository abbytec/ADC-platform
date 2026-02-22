import ADCCustomError, { type ADCCustomErrorJSON } from "../ADCCustomError.ts";

type IdentityErrorTypes =
	// Access / org isolation
	| "ORG_ACCESS_DENIED"
	| "GLOBAL_ONLY"
	| "CROSS_ORG_ROLE"
	| "CROSS_ORG_USER"
	| "CANNOT_MODIFY_PREDEFINED"
	| "CANNOT_DELETE_PREDEFINED"
	// Not found
	| "USER_NOT_FOUND"
	| "ROLE_NOT_FOUND"
	| "GROUP_NOT_FOUND"
	| "ORG_NOT_FOUND"
	| "REGION_NOT_FOUND"
	// Validation
	| "MISSING_FIELDS"
	| "INVALID_ROLE";

export class IdentityError extends ADCCustomError<Record<string, unknown>, IdentityErrorTypes> {
	public readonly name = "IdentityError";
}

/**
 * @public
 */
export type ADCIdentityErrorJSON = ADCCustomErrorJSON<Record<string, unknown>, IdentityErrorTypes>;
