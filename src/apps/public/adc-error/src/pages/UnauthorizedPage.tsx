import { useEffect } from "react";
import { useTranslation } from "@ui-library/utils/i18n-react";
import { ErrorCard } from "../components/ErrorCard.tsx";
import { readParam } from "../utils/params.ts";
import { goToLogin } from "@ui-library/utils/session";
import { isSafeReturnUrl } from "@common/utils/module-availability.js";

/**
 * El kernel manda acá cuando un módulo con `uiModule.access` se pide sin la sesión o los
 * roles que declaró: el bundle nunca salió del servidor.
 *
 * No se dice QUÉ rol faltaba. Quien llega hasta acá puede ser cualquiera, y enumerar los roles
 * que abren un panel de administración es un mapa gratis de la superficie interna.
 */
const REASONS = new Set(["auth", "role", "org", "unavailable"]);

/**
 * El `from` viaja por query string, así que es texto de quien arme el link. Sin este filtro
 * el botón de login lo reenviaría como `returnUrl` y la página sería un open-redirect
 * firmado por el dominio propio.
 */
function safeFrom(): string | undefined {
	const from = readParam("from", 2000);
	return from && isSafeReturnUrl(from) ? from : undefined;
}

/** ¿La página se cargó por un F5 (y no por la redirección del gate)? */
function isReload(): boolean {
	const entry = globalThis.performance?.getEntriesByType?.("navigation")?.[0] as PerformanceNavigationTiming | undefined;
	return entry?.type === "reload";
}

export function UnauthorizedPage() {
	const { t, ready } = useTranslation({ namespace: "adc-error", autoLoad: true });
	const raw = readParam("reason");
	const reason = REASONS.has(raw) ? raw : "role";
	const appName = readParam("app", 60);
	const from = safeFrom();

	// Actualizar la página es "ya me habilitaron, probá de nuevo": se vuelve a la URL original
	// y decide el gate del servidor, único que conoce los roles pedidos. Si sigue rechazando
	// devuelve acá, y esa carga ya no es un reload: no hay rebote infinito.
	useEffect(() => {
		if (from && isReload()) globalThis.location?.replace(from);
	}, [from]);

	if (!ready) return <adc-skeleton variant="rectangular" height="320px" />;

	return (
		<ErrorCard
			icon="🔒"
			title={t("unauthorized.title")}
			subtitle={appName ? t("unauthorized.subtitleApp", { app: appName }) : t("unauthorized.subtitle")}
			description={t(`unauthorized.${reason}`)}
			hint={from ? `${t("unauthorized.hint")} ${t("unauthorized.retryHint")}` : t("unauthorized.hint")}
			tone={reason === "unavailable" ? "warning" : "info"}
		>
			{reason === "auth" && <adc-button label={t("unauthorized.login")} variant="primary" onClick={() => goToLogin(from)} />}
		</ErrorCard>
	);
}
