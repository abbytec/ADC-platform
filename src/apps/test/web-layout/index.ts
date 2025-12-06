import { BaseApp } from "../../BaseApp.js";

/**
 * App Layout - Shell principal que contiene otras apps
 */
export default class WebLayoutApp extends BaseApp {
	async run() {
		this.logger.logOk(`${this.name} ejecutándose`);
	}
}
