import { BaseApp } from "../BaseApp.js";
import { JSON_FILE_CRUD_CAPABILITY, IJsonFileCrud } from "../../presets/JsonFileCrud/index.js";

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
	public name = "user-profile";

	protected requiredPresets = [JSON_FILE_CRUD_CAPABILITY];

	private crud!: IJsonFileCrud;
	private readonly PROFILE_KEY = "main_user_profile";

	async run(): Promise<void> {
		this.crud = this.kernel.get<IJsonFileCrud>(JSON_FILE_CRUD_CAPABILITY);

		// Intentar cargar el perfil existente
		let data = await this.crud.read<UserProfile>(this.PROFILE_KEY);

		if (data) {
			console.log(`[${this.name}] Perfil cargado:`, data);
			data.age += 1;
			data.lastUpdate = new Date().toISOString();
			console.log(`[${this.name}] Perfil actualizado a edad ${data.age}.`);
		} else {
			console.log(`[${this.name}] No se encontró perfil. Creando uno nuevo.`);
			data = {
				name: "Usuario ADC",
				age: 25,
				lastUpdate: new Date().toISOString(),
			};
		}

		await this.crud.update(this.PROFILE_KEY, data).then(()=>{
            console.log(`[${this.name}] Perfil guardado con éxito.`);
        }).catch(async (err: any) => {
			if (err.message.includes("no existe")) {
				await this.crud.create(this.PROFILE_KEY, data);
			} else {
				throw err;
			}
		});
	}

	async stop(): Promise<void> {
		console.log(`[${this.name}] Detenida.`);
	}
}
