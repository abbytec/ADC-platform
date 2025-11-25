import '@ui-library/loader';

// Traducciones locales (fallback si i18n del servidor no está disponible)
const translations = {
	es: {
		title: "Estadísticas del Sistema",
		reload: "Recargar Estadísticas",
		loading: "Cargando...",
		stats: {
			totalUsers: "Usuarios Totales",
			activeUsers: "Usuarios Activos",
			roles: "Roles Diferentes"
		}
	},
	en: {
		title: "System Statistics",
		reload: "Reload Statistics",
		loading: "Loading...",
		stats: {
			totalUsers: "Total Users",
			activeUsers: "Active Users",
			roles: "Different Roles"
		}
	}
};

/**
 * App de Home en Vanilla JavaScript
 * Funciona como standalone y como microfrontend en web-layout
 */
export default class HomeApp {
	constructor() {
		this.stats = null;
		this.loading = true;
		this.container = null;
		this.locale = this.detectLocale();
	}
	
	detectLocale() {
		const stored = localStorage.getItem('language');
		if (stored) return stored.split('-')[0];
		return (navigator.language || 'en').split('-')[0];
	}
	
	t(key) {
		// Si existe t() global, usarla primero
		if (window.t && window.__ADC_I18N__?.loaded) {
			return window.t(key, null, 'home');
		}
		// Fallback a traducciones locales
		const dict = translations[this.locale] || translations.en;
		const keys = key.split('.');
		let value = dict;
		for (const k of keys) {
			if (value && typeof value === 'object' && k in value) {
				value = value[k];
			} else {
				return key;
			}
		}
		return typeof value === 'string' ? value : key;
	}

	/**
	 * Método principal para montar la aplicación
	 * @param {HTMLElement} container - Elemento donde se montará la app
	 */
	mount(container) {
		this.container = container;
		this.render();
		this.loadStats();
	}

	/**
	 * Método para desmontar la aplicación
	 */
	unmount() {
		if (this.container) {
			this.container.innerHTML = '';
			this.container = null;
		}
	}

	/**
	 * Carga las estadísticas desde la API
	 */
	async loadStats() {
		this.loading = true;
		this.render();

		try {
			const response = await fetch('/api/dashboard/stats');
			if (!response.ok) {
				throw new Error('API no disponible');
			}
			const result = await response.json();
			if (result.success) {
				this.stats = result.data;
			}
		} catch (error) {
			console.log('[Home] API no disponible, usando datos mock');
			this.stats = {
				totalUsers: 150,
				activeUsers: 89,
				totalRoles: 8
			};
		} finally {
			this.loading = false;
			this.render();
		}
	}

	/**
	 * Handler para recargar estadísticas
	 */
	handleReload = () => {
		this.loadStats();
	}

	/**
	 * Renderiza la interfaz
	 */
	render() {
		if (!this.container) return;

		if (this.loading) {
			this.container.innerHTML = `
				<div class="loading">${this.t('loading')}</div>
			`;
			return;
		}

		this.container.innerHTML = `
			<div>
				<h2 style="margin-bottom: 20px;">${this.t('title')}</h2>
				
				<adc-button id="reload-btn">
					${this.t('reload')}
				</adc-button>

				${this.stats ? `
					<div class="stats-grid" style="
						display: grid; 
						gap: 20px; 
						grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
						margin-top: 20px;
					">
						<adc-stat-card
							card-title="${this.t('stats.totalUsers')}"
							value="${this.stats.totalUsers}"
							color="#0066cc"
						></adc-stat-card>
						<adc-stat-card
							card-title="${this.t('stats.activeUsers')}"
							value="${this.stats.activeUsers}"
							color="#10b981"
						></adc-stat-card>
						<adc-stat-card
							card-title="${this.t('stats.roles')}"
							value="${this.stats.totalRoles}"
							color="#f59e0b"
						></adc-stat-card>
					</div>
				` : ''}
			</div>
		`;

		// Agregar event listener al botón después de renderizar
		const reloadBtn = this.container.querySelector('#reload-btn');
		if (reloadBtn) {
			reloadBtn.addEventListener('adcClick', this.handleReload);
		}
	}
}

