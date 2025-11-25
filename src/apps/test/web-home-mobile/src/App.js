import '@ui-library/loader';

/**
 * App de Home Mobile en Vanilla JavaScript
 * Interfaz optimizada para dispositivos móviles con tema oscuro
 */
export default class HomeApp {
	constructor() {
		this.stats = null;
		this.loading = true;
		this.container = null;
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
			console.log('[Home Mobile] API no disponible, usando datos mock');
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
	 * Renderiza la interfaz móvil
	 */
	render() {
		if (!this.container) return;

		if (this.loading) {
			this.container.innerHTML = `
				<div style="
					display: flex;
					align-items: center;
					justify-content: center;
					min-height: 60vh;
					color: #a0aec0;
				">
					<div style="text-align: center;">
						<div style="
							width: 40px;
							height: 40px;
							border: 3px solid #4a5568;
							border-top-color: #805ad5;
							border-radius: 50%;
							animation: spin 1s linear infinite;
							margin: 0 auto 16px;
						"></div>
						<p style="margin: 0;">Cargando...</p>
					</div>
				</div>
				<style>
					@keyframes spin { to { transform: rotate(360deg); } }
				</style>
			`;
			return;
		}

		this.container.innerHTML = `
			<div style="padding: 8px 0;">
				<h2 style="
					margin: 0 0 20px;
					color: #e2e8f0;
					font-size: 1.25rem;
					font-weight: 600;
				">
					📊 Estadísticas
				</h2>
				
				<div style="margin-bottom: 20px;">
					<adc-button id="reload-btn">
						↻ Actualizar
					</adc-button>
				</div>

				${this.stats ? `
					<div style="
						display: flex;
						flex-direction: column;
						gap: 16px;
					">
						<adc-stat-card
							card-title="Usuarios Totales"
							value="${this.stats.totalUsers}"
							color="#805ad5"
						></adc-stat-card>
						<adc-stat-card
							card-title="Usuarios Activos"
							value="${this.stats.activeUsers}"
							color="#48bb78"
						></adc-stat-card>
						<adc-stat-card
							card-title="Roles"
							value="${this.stats.totalRoles}"
							color="#ed8936"
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

