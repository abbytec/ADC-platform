/**
 * Instalación PWA sin la infobar nativa.
 *
 * El `beforeinstallprompt` lo captura un script inline del `<head>` que inyecta el build de cada
 * app con `serviceWorker` (`buildPwaInstallCaptureScript` en UIFederationService), porque llega
 * antes de que Stencil monte. Acá sólo se lee el evento diferido y se lo dispara desde nuestra
 * propia UI.
 */

export interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallGlobal {
	__ADC_INSTALL_PROMPT__?: BeforeInstallPromptEvent | null;
	__ADC_INSTALL_CAPTURED__?: boolean;
}

const scope = globalThis as typeof globalThis & InstallGlobal;

/** Hay un prompt diferido listo para disparar. */
export const INSTALLABLE_EVENT = "adc:installable";
/** La app quedó instalada (o el prompt se consumió): esconder la oferta. */
export const INSTALLED_EVENT = "adc:installed";

// Respaldo para apps que no inyectan el script del head (sin `serviceWorker`, o servidas por un
// build ajeno). Llega tarde si el evento ya pasó, pero es lo único que puede hacer un chunk lazy.
if (!scope.__ADC_INSTALL_CAPTURED__) {
	scope.__ADC_INSTALL_CAPTURED__ = true;
	globalThis.addEventListener("beforeinstallprompt", (event) => {
		event.preventDefault();
		scope.__ADC_INSTALL_PROMPT__ = event as BeforeInstallPromptEvent;
		globalThis.dispatchEvent(new CustomEvent(INSTALLABLE_EVENT));
	});
	globalThis.addEventListener("appinstalled", () => {
		scope.__ADC_INSTALL_PROMPT__ = null;
		globalThis.dispatchEvent(new CustomEvent(INSTALLED_EVENT));
	});
}

/** Ya corre instalada: no tiene sentido ofrecer instalarla. */
export function isStandalone(): boolean {
	const displayMode = globalThis.matchMedia?.("(display-mode: standalone), (display-mode: minimal-ui)").matches;
	const iosLegacy = (globalThis.navigator as Navigator & { standalone?: boolean })?.standalone === true;
	return Boolean(displayMode || iosLegacy);
}

/**
 * WebKit no implementa `beforeinstallprompt`: en iOS/iPadOS la instalación es manual desde
 * «Compartir». iPadOS se hace pasar por Macintosh, de ahí el chequeo por táctil.
 */
export function isIos(): boolean {
	const ua = globalThis.navigator?.userAgent ?? "";
	if (/iPad|iPhone|iPod/.test(ua)) return true;
	return /Macintosh/.test(ua) && (globalThis.navigator?.maxTouchPoints ?? 0) > 1;
}

export function getDeferredPrompt(): BeforeInstallPromptEvent | null {
	return scope.__ADC_INSTALL_PROMPT__ ?? null;
}

/**
 * Dispara el prompt nativo. El evento se consume de una sola vez: haya aceptado o no, se
 * descarta para que la UI no ofrezca un botón muerto.
 */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
	const deferred = getDeferredPrompt();
	if (!deferred) return "unavailable";

	scope.__ADC_INSTALL_PROMPT__ = null;
	try {
		await deferred.prompt();
		const { outcome } = await deferred.userChoice;
		if (outcome === "accepted") globalThis.dispatchEvent(new CustomEvent(INSTALLED_EVENT));
		return outcome;
	} catch {
		return "dismissed";
	}
}
