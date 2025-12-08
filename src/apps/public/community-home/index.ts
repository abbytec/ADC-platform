import { BaseApp } from "../../BaseApp.js";

/**
 * Community Home - Página principal de la comunidad ADC
 */
export default class CommunityHomeApp extends BaseApp {
	async run() {
		this.logger.logOk(`${this.name} ejecutándose`);
	}
}
