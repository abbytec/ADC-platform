import { BaseApp } from "../../BaseApp.js";

/**
 * App Layout Mobile - Shell principal para dispositivos móviles
 */
export default class WebLayoutMobileApp extends BaseApp {
	async run() {
		this.logger.logOk(`${this.name} ejecutándose`);
	}
}

