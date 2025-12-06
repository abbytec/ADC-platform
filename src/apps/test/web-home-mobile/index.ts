import { BaseApp } from "../../BaseApp.js";
import type { IHttpServerProvider } from "../../../interfaces/modules/providers/IHttpServer.js";

/**
 * App Home Mobile - Página principal del dashboard (versión móvil)
 */
export default class WebHomeMobileApp extends BaseApp {
	async run() {
		this.logger.logOk(`${this.name} ejecutándose`);

		await this.#registerAPIEndpoints();
	}

	async #registerAPIEndpoints() {
		try {
			const httpProvider = this.kernel.getProvider<any>("express-server");
			const httpInstance = (await httpProvider.getInstance()) as IHttpServerProvider;

			httpInstance.registerRoute("GET", "/api/dashboard/stats", async (_req, res) => {
				try {
					const identityService = this.kernel.getService<any>("IdentityManagerService");
					const identityInstance = await identityService.getInstance();
					const stats = await identityInstance.getStats();

					res.json({
						success: true,
						data: {
							totalUsers: stats.users,
							activeUsers: stats.activeUsers || Math.floor(stats.users * 0.7),
							totalRoles: stats.roles,
						},
					});
				} catch (error: any) {
					res.status(500).json({
						success: false,
						error: error.message,
					});
				}
			});

			this.logger.logDebug("API endpoints registrados");
		} catch (error: any) {
			this.logger.logWarn(`No se pudieron registrar API endpoints: ${error.message}`);
		}
	}
}

