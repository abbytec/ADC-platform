export default {
	login: {
		title: "Iniciar Sesión",
		username: "Usuario o Email",
		password: "Contraseña",
		submit: "Ingresar",
		submitting: "Ingresando...",
		noAccount: "¿No tienes cuenta?",
		register: "Regístrate",
		orContinueWith: "O continúa con"
	},
	register: {
		title: "Crear Cuenta",
		username: "Nombre de Usuario",
		usernamePlaceholder: "tu_usuario",
		email: "Email",
		password: "Contraseña",
		confirmPassword: "Confirmar Contraseña",
		submit: "Crear Cuenta",
		submitting: "Creando cuenta...",
		hasAccount: "¿Ya tienes cuenta?",
		login: "Inicia sesión",
		orRegisterWith: "O regístrate con",
		passwordsMismatch: "Las contraseñas no coinciden",
		passwordTooShort: "La contraseña debe tener al menos 8 caracteres"
	},
	errors: {
		// Errores específicos de formulario (se muestran como callout inline)
		MISSING_CREDENTIALS: "Usuario y contraseña son requeridos",
		INVALID_CREDENTIALS: "Credenciales inválidas",
		ACCOUNT_DISABLED: "Cuenta desactivada",
		ACCOUNT_BLOCKED: "Cuenta bloqueada",
		ACCOUNT_BLOCKED_TEMP: "Cuenta bloqueada temporalmente. Intenta de nuevo en {{time}}.",
		ACCOUNT_BLOCKED_PERMANENT: "Tu cuenta ha sido bloqueada permanentemente. Contacta soporte.",
		MISSING_FIELDS: "Usuario, email y contraseña son requeridos",
		INVALID_USERNAME: "El nombre de usuario debe tener entre 3 y 30 caracteres",
		WEAK_PASSWORD: "La contraseña debe tener al menos 8 caracteres",
		INVALID_EMAIL: "El email no es válido",
		USERNAME_EXISTS: "El nombre de usuario ya está en uso",
		EMAIL_EXISTS: "El email ya está registrado",
		PASSWORDS_MISMATCH: "Las contraseñas no coinciden",
		PASSWORD_TOO_SHORT: "La contraseña debe tener al menos 8 caracteres",
		// Errores inesperados de auth (dominio)
		AUTH_ERROR: "Error durante la autenticación",
		AUTH_UNAVAILABLE: "Servicio de autenticación no disponible",
		SERVICE_UNAVAILABLE: "Servicio de identidad no disponible",
		PROVIDER_NOT_SUPPORTED: "Proveedor no soportado",
		PROVIDER_CONFIG_NOT_FOUND: "Proveedor no configurado",
		REGISTER_ERROR: "Error al crear la cuenta"
	}
};
