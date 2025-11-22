import { BaseApp } from "../../BaseApp.ts";

export default class UILibraryApp extends BaseApp {
	async run(): Promise<void> {
		this.logger.logInfo(`${this.name} - Librería de Web Components disponible`);
		this.logger.logOk(`${this.name} - Componentes Stencil listos para ser consumidos en cualquier framework`);
	}
}
