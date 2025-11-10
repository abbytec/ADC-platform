import { BaseApp } from "../../BaseApp.js";
import { IJsonFileCrud } from "../../../services/data/json-file-crud/index.js";
import { Logger } from "../../../utils/logger/Logger.js";

// La estructura de datos que manejaremos
interface UserProfile {
	name: string;
	age: number;
	lastUpdate: string;
}

/**
 * App que guarda, lee y actualiza un perfil de usuario
 * usando el service JsonFileCrud y almacenamiento en archivo.
 */
export default class UserProfileFileApp extends BaseApp {
	private crud!: IJsonFileCrud;

	async start() {
		try {
			const crudService = this.kernel.getService<any>("json-file-crud");
			
			if (typeof crudService?.getInstance === 'function') {
				this.crud = await crudService.getInstance();
			} else {
				this.crud = crudService;
			}
			
			Logger.ok(`[${this.name}] JsonFileCrudService disponible`);
		} catch (err) {
			Logger.error(`[${this.name}] JsonFileCrudService no disponible: ${err}`);
			throw err;
		}
	}

	async run(): Promise<void> {
		Logger.info(`\n[${this.name}] =============== INICIANDO PRUEBA ===============`);

		try {
			const profileKey = this.config.PROFILE_KEY || "user_profile";
			
			// 1. Intentar cargar el perfil existente
			let data = await this.crud.read<UserProfile>(profileKey);

			if (data) {
				Logger.info(`[${this.name}] Perfil cargado:`, data);
				data.age += 1;
				data.lastUpdate = new Date().toISOString();
				Logger.info(`[${this.name}] Perfil actualizado a edad ${data.age}.`);
				
				// Actualizar
				await this.crud.update(profileKey, data);
				Logger.ok(`[${this.name}] Perfil actualizado con éxito.`);
			} else {
				Logger.info(`[${this.name}] No se encontró perfil. Creando uno nuevo.`);
				data = {
					name: "Usuario ADC",
					age: 25,
					lastUpdate: new Date().toISOString(),
				};
				
				// Crear
				await this.crud.create(profileKey, data);
				Logger.ok(`[${this.name}] Perfil creado con éxito.`);
			}

			// 3. Listar archivos almacenados
			const files = await this.crud.listFiles();
			Logger.info(`[${this.name}] Archivos almacenados: ${files.length}`);
			if (files.length > 0) {
				Logger.debug(`[${this.name}] Contenido:`, files);
			}

			Logger.ok(`[${this.name}] =============== PRUEBA COMPLETADA ===============\n`);
		} catch (error: any) {
			Logger.error(`[${this.name}] Error durante la ejecución: ${error.message}`);
		}
	}
}
