import { BaseApp } from "../../BaseApp.js";

/**
 * ADC Layout - Shell principal que contiene otras apps de la comunidad
 */
export default class AdcLayoutApp extends BaseApp {
	async run() {
		this.logger.logOk(`${this.name} ejecutándose`);
	}
}
