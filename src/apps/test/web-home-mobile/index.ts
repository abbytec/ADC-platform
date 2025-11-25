import { BaseApp } from "../../BaseApp.js";

/**
 * App Home Mobile - Página principal del dashboard (versión móvil)
 */
export default class WebHomeMobileApp extends BaseApp {
	async run() {
		this.logger.logOk(`${this.name} ejecutándose`);
	}
}

