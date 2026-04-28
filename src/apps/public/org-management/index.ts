import { BaseApp } from "../../BaseApp.ts";

/**
 * Organization Management - Gestión de organizaciones en ADC Platform
 */
export default class OrgManagementApp extends BaseApp {
	async run() {
		this.logger.logOk(`${this.name} ejecutándose`);
	}
}
