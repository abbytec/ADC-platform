import React, { useState } from "react";
import { authApi, type BlockedErrorData } from "../utils/auth.ts";
import { useTranslation } from "@ui-library/utils/i18n-react";
import { clearErrors } from "@ui-library/utils/adc-fetch";
import { getUrl, getBaseUrl } from "@common/types/url-utils.js";

/** URL base del sitio principal según entorno */
const BASE_URL = getUrl(3011, "adigitalcafe.com");

/** Base URL for API calls */
const API_BASE = getBaseUrl(3000);

interface LoginProps {
	onNavigateToRegister: () => void;
	originPath: string;
}

/**
 * Formatea el tiempo de bloqueo restante en un mensaje legible
 */
function formatBlockedTime(blockedUntil: number): string {
	const now = Date.now();
	const remainingMs = blockedUntil - now;

	if (remainingMs <= 0) return "";

	const minutes = Math.ceil(remainingMs / (1000 * 60));
	if (minutes < 60) return `${minutes} minuto${minutes === 1 ? "" : "s"}`;

	const hours = Math.ceil(remainingMs / (1000 * 60 * 60));
	return `${hours} hora${hours === 1 ? "" : "s"}`;
}

/** Errores específicos de formulario login (se muestran inline como callout) */
const LOGIN_SPECIFIC_ERROR_KEYS = [
	{ key: "MISSING_CREDENTIALS", severity: "warning" },
	{ key: "INVALID_CREDENTIALS", severity: "error" },
	{ key: "ACCOUNT_DISABLED", severity: "warning" },
	{ key: "ACCOUNT_BLOCKED", severity: "warning" },
	{ key: "ACCOUNT_BLOCKED_TEMP", severity: "warning" },
	{ key: "ACCOUNT_BLOCKED_PERMANENT", severity: "error" },
];

export function Login({ onNavigateToRegister, originPath }: LoginProps) {
	const { t, ready } = useTranslation({ namespace: "adc-auth", autoLoad: true });
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);

	/**
	 * Construye la URL de redirección tras login exitoso
	 */
	const getRedirectUrl = (): string => {
		if (originPath && originPath !== "/") {
			return `${BASE_URL}${originPath}`;
		}
		return BASE_URL;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		clearErrors();
		setLoading(true);

		// authApi.login now handles errors internally via createAdcApi
		const result = await authApi.login(username, password, {
			translateParams: (data: BlockedErrorData) => ({
				time: data.blockedUntil ? formatBlockedTime(data.blockedUntil) : "",
			}),
		});

		if (result.success) {
			window.location.href = getRedirectUrl();
		}

		setLoading(false);
	};

	/**
	 * Construye URL de OAuth preservando originPath para el callback
	 */
	const getOAuthUrl = (provider: string): string => {
		const base = `${API_BASE}/api/auth/login/${provider}`;
		if (originPath && originPath !== "/") {
			return `${base}?originPath=${encodeURIComponent(originPath)}`;
		}
		console.log("OAuth base URL:", base);
		console.log("Origin Path:", originPath);
		return base;
	};

	// Skeleton mientras cargan las traducciones
	if (!ready) {
		return (
			<div className="w-full max-w-md">
				<adc-blur-panel variant="elevated" glow class="w-full bg-surface">
					<adc-skeleton variant="rectangular" height="364px" />
				</adc-blur-panel>
			</div>
		);
	}

	return (
		<div className="w-full max-w-md">
			<adc-blur-panel variant="elevated" glow class="w-full bg-surface">
				<h1 className="font-heading text-2xl font-bold text-center mb-6 text-text">{t("login.title")}</h1>

				{/* Handler de errores específicos del formulario (bloqueo de cuenta) */}
				<adc-custom-error variant="callout" keys={JSON.stringify(LOGIN_SPECIFIC_ERROR_KEYS)} class="mb-4" />

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label htmlFor="username" className="block text-sm font-medium mb-1 text-text">
							{t("login.username")}
						</label>
						<adc-input
							inputId="username"
							type="text"
							value={username}
							placeholder="tu@email.com"
							onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
						/>
					</div>

					<div>
						<label htmlFor="password" className="block text-sm font-medium mb-1 text-text">
							{t("login.password")}
						</label>
						<adc-input
							inputId="password"
							type="password"
							value={password}
							placeholder="••••••••"
							onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
						/>
					</div>

					<adc-button
						key={loading ? "loading" : "idle"}
						type="submit"
						class="w-full flex justify-end mt-8"
						disabled={loading}
						variant="primary"
					>
						{loading ? t("login.submitting") : t("login.submit")}
					</adc-button>
				</form>

				<div className="mt-6 text-center">
					<p className="text-sm text-muted">
						{t("login.noAccount")}{" "}
						<button type="button" onClick={onNavigateToRegister} className="text-accent hover:underline font-medium">
							{t("login.register")}
						</button>
					</p>
				</div>

				<div className="mt-6 pt-6 border-t border-divider">
					<p className="text-sm text-center text-muted mb-4">{t("login.orContinueWith")}</p>
					<div className="flex gap-3 justify-center">
						<a
							href={getOAuthUrl("discord")}
							className="flex items-center gap-2 px-4 py-2 bg-[#5865F2] text-white rounded-lg hover:brightness-110 transition-all"
						>
							<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
								<path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
							</svg>
							Discord
						</a>
						<a
							href={getOAuthUrl("google")}
							className="flex items-center gap-2 px-4 py-2 bg-white text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
						>
							<svg width="20" height="20" viewBox="0 0 24 24">
								<path
									fill="#4285F4"
									d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
								/>
								<path
									fill="#34A853"
									d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
								/>
								<path
									fill="#FBBC05"
									d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
								/>
								<path
									fill="#EA4335"
									d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
								/>
							</svg>
							Google
						</a>
					</div>
				</div>
			</adc-blur-panel>
		</div>
	);
}
