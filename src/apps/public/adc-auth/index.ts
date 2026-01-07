import { BaseApp } from "../../BaseApp.js";

/**
 * ADC Auth App - Sistema de autenticación
 * Host app para login/register via SessionManagerService
 */
export default class AdcAuthApp extends BaseApp {
	async run(): Promise<void> {
		this.logger.logOk("ADC Auth App iniciada");
	}
}
