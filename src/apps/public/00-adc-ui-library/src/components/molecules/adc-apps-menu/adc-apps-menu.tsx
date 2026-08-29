import { Component, Prop, State, Element, Host, Listen } from "@stencil/core";

import { getUnavailableApps } from "@common/utils/module-availability.js";
import { getSession, type SessionUser } from "../../../../utils/session.js";
import { INSTALLABLE_EVENT, INSTALLED_EVENT, getDeferredPrompt, isIos, isStandalone, promptInstall } from "../../../../utils/pwa-install.js";
import { trackPanelClamp } from "../../../utils/clamp-panel";
import { DEFAULT_APPS } from "./apps-config.js";
export interface AppMenuItem {
	id: string;
	name: string;
	url: string;
	icon?: string;
	/** Si se define, solo se muestra cuando el predicado retorna true con el usuario actual. */
	requires?: (user: SessionUser | undefined) => boolean;
	/**
	 * Nombre base del app en el kernel (ej: `adc-drive`). Si se define, el botón se
	 * oculta cuando la app está caída o deshabilitada vía modules-manager; sin él,
	 * el item se muestra siempre.
	 */
	moduleName?: string;
}

interface ADCGlobal {
	t?: (key: string, params?: Record<string, string> | null, namespace?: string) => string;
	loadTranslations?: (namespaces: string[], locale?: string) => Promise<void>;
	getLocale?: () => string;
}

const I18N_NAMESPACE = "adc-ui-library";
const adcI18n = globalThis as typeof globalThis & ADCGlobal;

type InstallKey = "action" | "iosHint";

const INSTALL_FALLBACKS: Record<"es" | "en", Record<InstallKey, string>> = {
	es: { action: "Instalar app", iosHint: "Tocá «Compartir» y elegí «Agregar a inicio»." },
	en: { action: "Install app", iosHint: "Tap “Share”, then choose “Add to Home Screen”." },
};

function fallbackLocale(): "es" | "en" {
	const language = (adcI18n.getLocale?.() || globalThis.document?.documentElement?.lang || globalThis.navigator?.language || "").toLowerCase();
	return language.startsWith("en") ? "en" : "es";
}

/** Icon tag name from app id: "community" → "adc-icon-app-community" */
function iconTag(id: string): string {
	return `adc-icon-app-${id}`;
}

@Component({
	tag: "adc-apps-menu",
	styleUrl: "adc-apps-menu.css",
	shadow: true,
})
export class AdcAppsMenu {
	@Element() el!: HTMLElement;

	/** Override default apps list (JSON array of AppMenuItem) */
	@Prop() apps?: string;

	@State() open = false;
	@State() sessionUser: SessionUser | undefined = undefined;
	/** Hay prompt de instalación diferido (Chromium) o corresponde el instructivo de iOS. */
	@State() installable = false;
	@State() showIosHint = false;
	@State() private i18nVersion = 0;

	/** Apps caídas/deshabilitadas (nombres base): sus botones no se muestran. */
	#unavailable: ReadonlySet<string> = new Set();

	#dropdownEl?: HTMLElement;
	#untrackClamp: (() => void) | null = null;

	async componentWillLoad() {
		// En paralelo: la sesión (predicados `requires`) y el estado de plataforma
		// (`__ADC_PLATFORM__`: 0 fetch en prod, 1 fetch cacheado en dev). Ambos degradan.
		const [session, unavailable] = await Promise.all([
			getSession(false).catch(() => null),
			getUnavailableApps().catch(() => new Set<string>()),
		]);
		this.sessionUser = session?.authenticated ? session.user : undefined;
		this.#unavailable = unavailable;
	}

	connectedCallback() {
		this.refreshInstallable();
		globalThis.addEventListener(INSTALLABLE_EVENT, this.refreshInstallable);
		globalThis.addEventListener(INSTALLED_EVENT, this.refreshInstallable);
		globalThis.addEventListener("adc:i18n:loaded", this.handleI18nLoaded);
		adcI18n.loadTranslations?.([I18N_NAMESPACE]).catch(() => undefined);
	}

	componentDidRender() {
		// El botón de apps vive en el medio del header: en mobile el panel anclado a su borde
		// derecho se sale por la izquierda.
		if (this.open && this.#dropdownEl && !this.#untrackClamp) {
			this.#untrackClamp = trackPanelClamp(this.el, this.#dropdownEl);
		} else if (!this.open && this.#untrackClamp) {
			this.#untrackClamp();
			this.#untrackClamp = null;
		}
	}

	disconnectedCallback() {
		this.#untrackClamp?.();
		this.#untrackClamp = null;
		globalThis.removeEventListener(INSTALLABLE_EVENT, this.refreshInstallable);
		globalThis.removeEventListener(INSTALLED_EVENT, this.refreshInstallable);
		globalThis.removeEventListener("adc:i18n:loaded", this.handleI18nLoaded);
	}

	private readonly handleI18nLoaded = () => {
		this.i18nVersion += 1;
	};

	private readonly refreshInstallable = () => {
		this.installable = !isStandalone() && (getDeferredPrompt() !== null || isIos());
	};

	private translateInstall(key: InstallKey): string {
		const translationKey = `install.${key}`;
		const translated = adcI18n.t?.(translationKey, null, I18N_NAMESPACE);
		if (translated && translated !== translationKey) return translated;
		return INSTALL_FALLBACKS[fallbackLocale()][key];
	}

	/** En iOS no hay prompt que disparar: el ítem despliega el instructivo del share sheet. */
	private readonly handleInstallClick = async () => {
		if (getDeferredPrompt()) {
			await promptInstall();
			this.refreshInstallable();
			this.open = false;
			return;
		}
		this.showIosHint = !this.showIosHint;
	};

	private get appList(): AppMenuItem[] {
		let list: AppMenuItem[] = DEFAULT_APPS;
		if (this.apps) {
			try {
				list = JSON.parse(this.apps);
			} catch {
				list = DEFAULT_APPS;
			}
		}
		return list
			.filter((app) => !app.moduleName || !this.#unavailable.has(app.moduleName))
			.filter((app) => (app.requires ? app.requires(this.sessionUser) : true));
	}

	@Listen("mousedown", { target: "document" })
	handleOutsideClick(e: MouseEvent) {
		if (this.open && !this.el.contains(e.target as Node)) {
			this.open = false;
		}
	}

	private readonly toggle = () => {
		this.open = !this.open;
		if (!this.open) this.showIosHint = false;
	};

	private readonly isCurrent = (url: string): boolean => {
		const origin = globalThis.location?.origin;
		return origin === url || origin + "/" === url + "/";
	};

	private renderInstall() {
		return [
			<button key="install" type="button" class="install-link" onClick={this.handleInstallClick} aria-expanded={isIos() ? String(this.showIosHint) : undefined}>
				<adc-icon-download size="1.25rem"></adc-icon-download>
				<span class="app-label">{this.translateInstall("action")}</span>
			</button>,
			this.showIosHint && (
				<p key="install-hint" class="install-hint">
					{this.translateInstall("iosHint")}
				</p>
			),
		];
	}

	render() {
		const apps = this.appList;

		return (
			<Host>
				<button type="button" class="apps-trigger" onClick={this.toggle} aria-label="Apps" aria-expanded={String(this.open)} title="Apps">
					<adc-icon-apps></adc-icon-apps>
				</button>

				{this.open && (
					<div class="apps-dropdown" ref={(el) => (this.#dropdownEl = el)}>
						{apps.map((app) => {
							const IconTag = iconTag(app.id);
							return (
								<a key={app.id} href={app.url} class="app-link" {...(this.isCurrent(app.url) ? { "data-active": "" } : {})}>
									<IconTag size="1.75rem"></IconTag>
									<span class="app-label">{app.name}</span>
								</a>
							);
						})}

						{this.installable && this.renderInstall()}
					</div>
				)}
			</Host>
		);
	}
}
