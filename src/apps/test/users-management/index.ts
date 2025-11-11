import { BaseApp } from "../../BaseApp.js";
import type { Kernel } from "../../../kernel.js";

export default class UsersManagementApp extends BaseApp {
	constructor(
		kernel: Kernel,
		name: string,
		config: any,
		filePath: string
	) {
		super(kernel, name, config, filePath);
	}

	async run(): Promise<void> {
		this.logger.logInfo(`${this.name} - Gestión de usuarios disponible`);
		this.logger.logOk(`${this.name} - Sub-app cargada en rutas /users/*`);
	}
}

