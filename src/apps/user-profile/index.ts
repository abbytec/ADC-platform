import { BaseApp } from "../BaseApp.js";
import { JSON_FILE_CRUD_PRESET, IJsonFileCrud } from "../../presets/JsonFileCrud/index.js";
import { Logger } from "../../utils/Logger.js";

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
	public readonly name = "user-profile";

	private crud!: IJsonFileCrud;
	private readonly PROFILE_KEY = "main_user_profile";

	async start(){
		this.crud = this.kernel.getPreset<IJsonFileCrud>(JSON_FILE_CRUD_PRESET);
	}

	async run(): Promise<void> {
		// Intentar cargar el perfil existente
		let data = await this.crud.read<UserProfile>(this.PROFILE_KEY);

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

		await this.crud.update(this.PROFILE_KEY, data).then(()=>{
            Logger.ok(`[${this.name}] Perfil guardado con éxito.`);
        }).catch(async (err: any) => {
			if (err.message.includes("no existe")) {
				await this.crud.create(this.PROFILE_KEY, data);
			} else {
				throw err;
			}
		});
	}
}
