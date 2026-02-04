export default {
	errors: {
		// Generic HTTP errors
		http: {
			400: "Bad request",
			401: "Authentication required",
			403: "Access denied",
			404: "Resource not found",
			409: "Conflict with current state",
			500: "Internal server error",
			503: "Service unavailable"
		},
		// Global errors (not domain-specific)
		FORBIDDEN: "Access denied",
		UNAUTHORIZED: "Unauthorized",
		UNHANDLED_ERROR: "An unexpected error occurred",
		UNKNOWN_ERROR: "Unknown error",
		// Generic session/auth errors (authGenericErrors)
		NO_SESSION: "No active session",
		INVALID_SESSION: "Invalid session",
		NO_REFRESH_TOKEN: "No refresh token",
		INVALID_REFRESH_TOKEN: "Invalid refresh token",
		LOCATION_CHANGE: "Session invalidated due to location change",
		REFRESH_FAILED: "Error refreshing tokens"
	}
};
