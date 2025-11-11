import { BaseApp } from "../../BaseApp.js";
import type { IHttpServerProvider } from "../../../interfaces/modules/providers/IHttpServer.js";

/**
 * DashboardApp - Panel de administración de la plataforma ADC
 * 
 * Esta app proporciona una interfaz web para administrar usuarios
 * y conecta con IdentityManagerService para gestionar identidades.
 * 
 * Se registra automáticamente en UIFederationService como "dashboard".
 */
export default class DashboardApp extends BaseApp {
	async run(): Promise<void> {
		this.logger.logInfo(`${this.name} - Iniciando Dashboard`);

		try {
			// Obtener el HttpServerProvider para registrar APIs
			const httpProviderModule = this.kernel.getProvider<any>("express-server");
			const httpProvider = await httpProviderModule.getInstance() as IHttpServerProvider;

			// Obtener IdentityManagerService
			const identityService = this.kernel.getService<any>("IdentityManagerService");
			const identity = typeof identityService?.getInstance === 'function'
				? await identityService.getInstance()
				: identityService;

			// API: Listar usuarios
			httpProvider.registerRoute("GET", "/api/users", async (req, res) => {
				try {
					const users = await identity.getAllUsers();
					res.json({ success: true, data: users });
				} catch (error: any) {
					this.logger.logError(`Error listando usuarios: ${error.message}`);
					res.status(500).json({ success: false, error: error.message });
				}
			});

			// API: Crear usuario
			httpProvider.registerRoute("POST", "/api/users", async (req, res) => {
				try {
					const { username, password, role } = req.body;

					if (!username || !password) {
						return res.status(400).json({
							success: false,
							error: "Username y password son requeridos",
						});
					}

					// Obtener el ID del rol si se proporcionó
					let roleIds: string[] | undefined;
					if (role) {
						const allRoles = await identity.getAllRoles();
						const roleObj = allRoles.find((r: any) => r.name === role);
						roleIds = roleObj ? [roleObj.id] : undefined;
					}

					const newUser = await identity.createUser(username, password, roleIds);

					res.json({ success: true, data: newUser });
				} catch (error: any) {
					this.logger.logError(`Error creando usuario: ${error.message}`);
					res.status(500).json({ success: false, error: error.message });
				}
			});

			// API: Obtener usuario por ID
			httpProvider.registerRoute("GET", "/api/users/:id", async (req, res) => {
				try {
					const user = await identity.getUserById(req.params.id);
					if (!user) {
						return res.status(404).json({
							success: false,
							error: "Usuario no encontrado",
						});
					}
					res.json({ success: true, data: user });
				} catch (error: any) {
					this.logger.logError(`Error obteniendo usuario: ${error.message}`);
					res.status(500).json({ success: false, error: error.message });
				}
			});

			// API: Eliminar usuario
			httpProvider.registerRoute("DELETE", "/api/users/:id", async (req, res) => {
				try {
					await identity.deleteUser(req.params.id);
					res.json({ success: true, message: "Usuario eliminado" });
				} catch (error: any) {
					this.logger.logError(`Error eliminando usuario: ${error.message}`);
					res.status(500).json({ success: false, error: error.message });
				}
			});

			// API: Obtener estadísticas del dashboard
			httpProvider.registerRoute("GET", "/api/dashboard/stats", async (req, res) => {
				try {
					const users = await identity.getAllUsers();
					const allRoles = await identity.getAllRoles();
					const stats = {
						totalUsers: users.length,
						activeUsers: users.filter((u: any) => u.isActive).length,
						totalRoles: allRoles.length,
						roles: {} as Record<string, number>,
					};

					// Contar usuarios por rol
					for (const user of users) {
						for (const roleId of user.roleIds || []) {
							const role = allRoles.find((r: any) => r.id === roleId);
							if (role) {
								stats.roles[role.name] = (stats.roles[role.name] || 0) + 1;
							}
						}
					}

					res.json({ success: true, data: stats });
				} catch (error: any) {
					this.logger.logError(`Error obteniendo estadísticas: ${error.message}`);
					res.status(500).json({ success: false, error: error.message });
				}
			});

			this.logger.logOk(`${this.name} - APIs registradas`);
			this.logger.logOk(`${this.name} - Dashboard disponible en http://localhost:3000/ui/dashboard/`);
		} catch (error: any) {
			this.logger.logError(`Error iniciando Dashboard: ${error.message}`);
			throw error;
		}
	}
}

