import { BaseApp } from "../../BaseApp.js";

/**
 * App Config - Página de configuración del sistema
 */
export default class WebConfigApp extends BaseApp {
	async run() {
		this.logger.logOk(`${this.name} ejecutándose`);
	}
}

