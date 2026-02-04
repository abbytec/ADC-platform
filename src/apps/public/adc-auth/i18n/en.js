export default {
	login: {
		title: "Sign In",
		username: "Username or Email",
		password: "Password",
		submit: "Sign In",
		submitting: "Signing in...",
		noAccount: "Don't have an account?",
		register: "Sign up",
		orContinueWith: "Or continue with"
	},
	register: {
		title: "Create Account",
		username: "Username",
		usernamePlaceholder: "your_username",
		email: "Email",
		password: "Password",
		confirmPassword: "Confirm Password",
		submit: "Create Account",
		submitting: "Creating account...",
		hasAccount: "Already have an account?",
		login: "Sign in",
		orRegisterWith: "Or sign up with",
		passwordsMismatch: "Passwords don't match",
		passwordTooShort: "Password must be at least 8 characters"
	},
	errors: {
		// Form-specific errors (shown as inline callout)
		MISSING_CREDENTIALS: "Username and password are required",
		INVALID_CREDENTIALS: "Invalid credentials",
		ACCOUNT_BLOCKED: "Account blocked",
		ACCOUNT_BLOCKED_TEMP: "Account temporarily blocked. Try again in {{time}}.",
		ACCOUNT_BLOCKED_PERMANENT: "Your account has been permanently blocked. Contact support.",
		MISSING_FIELDS: "Username, email and password are required",
		INVALID_USERNAME: "Username must be between 3 and 30 characters",
		WEAK_PASSWORD: "Password must be at least 8 characters",
		INVALID_EMAIL: "Invalid email address",
		USERNAME_EXISTS: "Username is already taken",
		EMAIL_EXISTS: "Email is already registered",
		PASSWORDS_MISMATCH: "Passwords don't match",
		PASSWORD_TOO_SHORT: "Password must be at least 8 characters",
		// Unexpected auth errors (domain)
		AUTH_ERROR: "Authentication error",
		AUTH_UNAVAILABLE: "Authentication service unavailable",
		SERVICE_UNAVAILABLE: "Identity service unavailable",
		PROVIDER_NOT_SUPPORTED: "Provider not supported",
		PROVIDER_CONFIG_NOT_FOUND: "Provider not configured",
		REGISTER_ERROR: "Error creating account"
	}
};
