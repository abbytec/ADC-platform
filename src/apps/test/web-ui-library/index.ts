import { BaseApp } from "../../BaseApp.js";

/**
 * UILibraryApp - Librería de componentes UI compartidos
 * 
 * Esta app proporciona componentes reutilizables (PrimaryButton, Card, Layout)
 * que otras apps UI pueden importar via import maps.
 * 
 * Se registra automáticamente en UIFederationService como "ui-library".
 */
export default class UILibraryApp extends BaseApp {
	async run(): Promise<void> {
		this.logger.logInfo(`${this.name} - Librería de componentes UI disponible`);
		
		// Esta app no tiene lógica de negocio activa,
		// simplemente proporciona componentes estáticos
		// que se sirven vía el servidor HTTP
		
		this.logger.logOk(`${this.name} - Componentes listos para ser consumidos`);
	}
}

