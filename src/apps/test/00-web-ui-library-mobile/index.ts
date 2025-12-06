import { BaseApp } from "../../BaseApp.ts";

export default class UILibraryMobileApp extends BaseApp {
	async run(): Promise<void> {
		this.logger.logInfo(`${this.name} - Librería de Web Components Mobile disponible`);
		this.logger.logOk(`${this.name} - Componentes Stencil Mobile listos para ser consumidos`);
	}
}

