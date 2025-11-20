import { BaseApp } from "../../BaseApp.js";

/**
 * App Home - Página principal del dashboard
 */
export default class WebHomeApp extends BaseApp {
	async run() {
		this.logger.logOk(`${this.name} ejecutándose`);
	}
}

