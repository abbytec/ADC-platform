import { BaseApp } from "../../BaseApp.js";

/**
 * ADC Identity App - Panel de gestión de identidades
 * Administración de usuarios, roles, grupos, organizaciones y regiones
 */
export default class AdcIdentityApp extends BaseApp {
	async run(): Promise<void> {
		this.logger.logOk("ADC Identity App iniciada");
	}
}
