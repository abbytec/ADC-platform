import { Component, Prop, State, h, Event, EventEmitter } from "@stencil/core";

interface SessionUser {
	id: string;
	username: string;
	email: string;
	avatar?: string;
}

interface SessionResponse {
	authenticated: boolean;
	user?: SessionUser;
}

export interface AccessMenuItem {
	label: string;
	href: string;
	icon?: string;
}

/**
 * Botón de acceso que muestra:
 * - Si logueado: avatar + dropdown con menú de items + logout
 * - Si no logueado: botón "Ingresar" que redirige a auth
 */
@Component({
	tag: "adc-access-button",
	shadow: false,
})
export class AdcAccessButton {
	/** URL base del auth (en dev: localhost:3012, en prod: auth.adigitalcafe.com) */
	@Prop() authUrl: string = "https://auth.adigitalcafe.com";

	/** URL base de la API (en dev: http://localhost:3000, en prod: vacío para usar relativo) */
	@Prop() apiBaseUrl: string = "";

	/** URL de la API de sesión */
	@Prop() sessionApiUrl: string = "/api/auth/session";

	/** URL de logout */
	@Prop() logoutApiUrl: string = "/api/auth/logout";

	/** Texto del botón cuando no está logueado */
	@Prop() loginText: string = "Ingresar";

	/** Texto del botón de logout */
	@Prop() logoutText: string = "Cerrar sesión";

	/** Items del menú dropdown (array de {label, href, icon?}) */
	@Prop() menuItems: AccessMenuItem[] = [];

	/** Estado de autenticación */
	@State() isAuthenticated: boolean = false;

	/** Datos del usuario */
	@State() user: SessionUser | null = null;

	/** Estado de carga */
	@State() loading: boolean = true;

	/** Dropdown abierto */
	@State() dropdownOpen: boolean = false;

	/** Evento emitido al cerrar sesión */
	@Event() adcLogout!: EventEmitter<void>;

	/** Evento emitido al hacer login */
	@Event() adcLoginClick!: EventEmitter<void>;

	private hoverTimeout?: ReturnType<typeof setTimeout>;

	componentWillLoad() {
		this.checkSession();
	}

	disconnectedCallback() {
		if (this.hoverTimeout) clearTimeout(this.hoverTimeout);
	}

	/** Construye URL completa para la API */
	private getApiUrl(path: string): string {
		return `${this.apiBaseUrl}${path}`;
	}

	private async checkSession() {
		try {
			const response = await fetch(this.getApiUrl(this.sessionApiUrl), {
				method: "GET",
				credentials: "include",
			});

			// Si no hay sesión (401) o hay error, marcar como no autenticado
			if (!response.ok) {
				this.isAuthenticated = false;
				this.user = null;
				return;
			}

			const data: SessionResponse = await response.json();

			this.isAuthenticated = data.authenticated;
			this.user = data.user || null;
		} catch {
			this.isAuthenticated = false;
			this.user = null;
		} finally {
			this.loading = false;
		}
	}

	private handleLoginClick = () => {
		this.adcLoginClick.emit();
		// Pasar la ruta actual como originPath para redirigir tras login
		const currentPath = window.location.pathname;
		const originParam = currentPath && currentPath !== "/" ? `?originPath=${encodeURIComponent(currentPath)}` : "";
		window.location.href = `${this.authUrl}/login${originParam}`;
	};

	private handleLogout = async () => {
		try {
			await fetch(this.getApiUrl(this.logoutApiUrl), {
				method: "POST",
				credentials: "include",
			});
		} catch {
			// Continuar con logout local aunque falle la API
		}

		this.isAuthenticated = false;
		this.user = null;
		this.dropdownOpen = false;
		this.adcLogout.emit();
	};

	private handleMouseEnter = () => {
		if (this.hoverTimeout) clearTimeout(this.hoverTimeout);
		this.dropdownOpen = true;
	};

	private handleMouseLeave = () => {
		this.hoverTimeout = setTimeout(() => {
			this.dropdownOpen = false;
		}, 150);
	};

	private handleToggle = () => {
		this.dropdownOpen = !this.dropdownOpen;
	};

	private handleKeyDown = (event: KeyboardEvent) => {
		if (event.key === "Escape") {
			this.dropdownOpen = false;
		}
	};

	/**
	 * Genera URL de avatar usando DiceBear API (avatares procedurales)
	 * Usa el ID del usuario como seed para consistencia
	 */
	private getAvatarUrl(): string {
		if (this.user?.avatar) {
			return this.user.avatar;
		}

		// DiceBear - avatares procedurales gratuitos
		const seed = this.user?.id || this.user?.username || "default";
		return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
	}

	render() {
		if (this.loading) {
			return (
				<div class="w-10 h-10 rounded-full bg-muted animate-pulse" role="status">
					<span class="sr-only">Cargando sesión</span>
				</div>
			);
		}

		// No autenticado - mostrar botón de login
		if (!this.isAuthenticated) {
			return (
				<button
					type="button"
					onClick={this.handleLoginClick}
					class="flex items-center gap-2 px-3 py-2 hover:underline transition-colors cursor-pointer min-h-[44px] touch-manipulation"
				>
					{/* User icon */}
					<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
						/>
					</svg>
					<span>{this.loginText}</span>
				</button>
			);
		}

		// Autenticado - mostrar avatar con dropdown
		return (
			<div class="relative inline-block" onMouseEnter={this.handleMouseEnter} onMouseLeave={this.handleMouseLeave}>
				<button
					type="button"
					class="flex items-center gap-2 p-1 rounded-full hover:bg-accent/10 transition-all cursor-pointer"
					aria-haspopup="menu"
					aria-expanded={this.dropdownOpen ? "true" : "false"}
					onClick={this.handleToggle}
					onKeyDown={this.handleKeyDown}
				>
					{/* Header del dropdown con info del usuario */}
					<div class="pl-4 pr-2">
						<p class="font-semibold truncate">{this.user?.username}</p>
					</div>
					<img
						src={this.getAvatarUrl()}
						alt={`Avatar de ${this.user?.username || "usuario"}`}
						class="w-10 h-10 rounded-full border-2 border-accent object-cover"
						width="40"
						height="40"
					/>
					<svg
						class={`w-4 h-4 transition-transform ${this.dropdownOpen ? "rotate-180" : ""}`}
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
					</svg>
				</button>

				{this.dropdownOpen && (
					<div
						class="absolute right-0 top-full mt-2 w-56 rounded-lg shadow-lg z-50 bg-surface text-tsurface overflow-hidden"
						role="menu"
						aria-orientation="vertical"
					>
						{/* Items del menú */}
						{this.menuItems.length > 0 && (
							<div class="py-1">
								{this.menuItems.map((item) => (
									<a
										href={item.href}
										class="flex items-center gap-2 px-4 py-2 hover:bg-accent text-tprimary transition-colors"
										role="menuitem"
									>
										{item.icon && <span class="w-5 h-5 flex items-center justify-center" innerHTML={item.icon}></span>}
										{item.label}
									</a>
								))}
							</div>
						)}

						{/* Separador y logout */}
						<div class="border-t border-divider">
							<button
								type="button"
								class="flex w-full items-center gap-2 px-4 py-3 text-left bg-neutral-900 hover:bg-primary hover:text-tprimary hover:cursor-pointer text-red-600 transition-colors"
								role="menuitem"
								onClick={this.handleLogout}
							>
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
									/>
								</svg>
								{this.logoutText}
							</button>
						</div>
					</div>
				)}
			</div>
		);
	}
}
