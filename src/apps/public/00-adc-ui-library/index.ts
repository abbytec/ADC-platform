import { BaseApp } from "../../BaseApp.ts";

export default class AdcUILibraryApp extends BaseApp {
	async run(): Promise<void> {
		this.logger.logInfo(`${this.name} - ADC UI Library disponible`);
		this.logger.logOk(`${this.name} - Componentes Stencil listos para ser consumidos`);
	}
}
