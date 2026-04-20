import { BaseApp } from "../../BaseApp.js";

/**
 * ADC Project Manager App - Panel de gestión de proyectos tipo Jira
 */
export default class AdcProjectManagerApp extends BaseApp {
	async run(): Promise<void> {
		this.logger.logOk("ADC Project Manager App iniciada");
	}
}
