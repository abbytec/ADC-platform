import { BaseApp } from "../BaseApp.js";
import { IJsonFileCrud } from "../../presets/json-file-crud/index.js";
import { Logger } from "../../utils/Logger/Logger.js";

// La estructura de datos que manejaremos
interface UserProfile {
	name: string;
	age: number;
	lastUpdate: string;
}

/**
 * App que guarda, lee y actualiza un perfil de usuario
 * usando el preset JsonFileCrud.
 */
export default class UserProfileApp extends BaseApp {
	private crud!: IJsonFileCrud;

	async start() {
		const presetConfig = this.config.modules.presets.find((p: any) => p.name === "json-file-crud");
		this.crud = this.kernel.getPreset<IJsonFileCrud>("json-file-crud", presetConfig.config);
	}

	async run(): Promise<void> {
		// Intentar cargar el perfil existente
		let data = await this.crud.read<UserProfile>(this.config.PROFILE_KEY);

		if (data) {
			Logger.info(`[${this.name}] Perfil cargado:`, data);
			data.age += 1;
			data.lastUpdate = new Date().toISOString();
			Logger.info(`[${this.name}] Perfil actualizado a edad ${data.age}.`);
		} else {
			Logger.info(`[${this.name}] No se encontró perfil. Creando uno nuevo.`);
			data = {
				name: "Usuario ADC",
				age: 25,
				lastUpdate: new Date().toISOString(),
			};
		}

		await this.crud
			.update(this.config.PROFILE_KEY, data)
			.then(() => {
				Logger.ok(`[${this.name}] Perfil guardado con éxito.`);
			})
			.catch(async (err: any) => {
				if (err.message.includes("no existe")) {
					await this.crud.create(this.config.PROFILE_KEY, data);
				} else {
					throw err;
				}
			});
	}
}
