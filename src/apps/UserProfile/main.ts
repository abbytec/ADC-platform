import { IFileAdapter, JSON_ADAPTER_CAPABILITY } from "../../interfaces/middlewares/adapters/IFIleAdapter.js";
import { IStorage, STORAGE_CAPABILITY } from "../../interfaces/providers/IStorage.js";
import { BaseApp } from "../BaseApp.js";


// La estructura de datos que manejaremos
interface UserProfile {
  name: string;
  age: number;
  lastUpdate: string;
}

/**
 * App que guarda, lee y actualiza un perfil de usuario
 * en cada ejecución.
 */
export default class UserProfileApp extends BaseApp {
  public name = "user-profile";

  protected requiredProviders = [STORAGE_CAPABILITY];
  protected requiredMiddlewares = [JSON_ADAPTER_CAPABILITY];

  private storage!: IStorage;
  private json!: IFileAdapter<any>;

  private readonly PROFILE_KEY = "main_user_profile";


  async run(): Promise<void> {
    this.storage = this.kernel.get(STORAGE_CAPABILITY);
    this.json = this.kernel.get<IFileAdapter<any>>(JSON_ADAPTER_CAPABILITY); // <-- Actualizado
      let data = await this.storage.load(this.PROFILE_KEY)
          .then(buf => buf ? this.json.fromBuffer(buf) : null);
      const save = (data: UserProfile) => this.storage.save(this.PROFILE_KEY, this.json.toBuffer(data));

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
        lastUpdate: new Date().toISOString()
      };
    }

    // 6. Guardar los cambios
    save(data);
    
    console.log(`[${this.name}] Perfil guardado con éxito.`);
  }

  async stop(): Promise<void> {
    console.log(`[${this.name}] Detenida.`);
  }
}

