import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { BaseService } from "../../BaseService.js";
import { Kernel } from "../../../kernel.js";
import type { IUIFederationService, RegisteredUIModule } from "./types.js";
import type { ImportMap, UIModuleConfig } from "../../../interfaces/modules/IUIModule.js";
import type { IHttpServerProvider } from "../../../interfaces/modules/providers/IHttpServer.js";

/**
 * UIFederationService - Gestiona la federación de módulos UI
 * 
 * **Modo Kernel:**
 * Este servicio se ejecuta en modo kernel (kernelMode: true),
 * lo que significa que está disponible globalmente.
 * 
 * **Funcionalidades:**
 * - Gestiona el import map dinámico
 * - Genera astro.config.mjs automáticamente para apps UI
 * - Ejecuta builds de Astro
 * - Coordina con HttpServerProvider para servir archivos
 * - Registra/desregistra módulos UI dinámicamente
 * 
 * @example
 * ```typescript
 * const uiFederation = kernel.getService<IUIFederationService>("UIFederationService");
 * 
 * // Registrar un módulo UI
 * await uiFederation.registerUIModule("dashboard", "/path/to/app", config);
 * 
 * // Obtener el import map
 * const importMap = uiFederation.getImportMap();
 * ```
 */
export default class UIFederationService extends BaseService<IUIFederationService> {
	public readonly name = "UIFederationService";

	private readonly registeredModules = new Map<string, RegisteredUIModule>();
	private importMap: ImportMap = { imports: {} };
	private httpProvider: IHttpServerProvider | null = null;
	private readonly uiOutputBaseDir: string;
	private port: number = 3000;

	constructor(kernel: any, options?: any) {
		super(kernel, options);

		// Directorio base para outputs de UI
		const isDevelopment = process.env.NODE_ENV === "development";
		const basePath = isDevelopment ? path.resolve(process.cwd(), "src") : path.resolve(process.cwd(), "dist");
		this.uiOutputBaseDir = path.resolve(basePath, "..", "temp", "ui-builds");

		// Puerto del servidor
		this.port = options?.port || 3000;
	}

	async start(): Promise<void> {
		// Crear directorio base para outputs si no existe
		await fs.mkdir(this.uiOutputBaseDir, { recursive: true });

		// Cargar express-server provider ANTES de super.start()
		// porque el provider debe estar disponible antes de que BaseService lo busque
		try {
			this.logger.logInfo("Cargando HttpServerProvider...");
			
			const providerConfig = {
				name: "express-server",
				version: "latest",
				language: "typescript"
			};
			
			// Cargar el provider directamente (será reutilizado si ya existe)
			const provider = await Kernel.moduleLoader.loadProvider(providerConfig);
			this.kernel.registerProvider(provider.name, provider, provider.type, providerConfig, null);
			
			// Obtener el provider del kernel
			const providerModule = this.getProvider<any>("express-server");
			this.logger.logOk("HttpServerProvider cargado");
			
			// Obtener la instancia del provider (no el provider en sí)
			this.httpProvider = await providerModule.getInstance();
		} catch (error: any) {
			this.logger.logError(`Error cargando HttpServerProvider: ${error.message}`);
			throw error;
		}

		// Ahora llamar a super.start() que cargará otros providers/utilities del config
		await super.start();

		// Registrar endpoint para el import map
		await this.#setupImportMapEndpoint();

		// Iniciar el servidor HTTP
		await this.httpProvider!.listen(this.port);

		this.logger.logOk("UIFederationService iniciado");
	}

	async stop(): Promise<void> {
		// Detener el servidor HTTP
		if (this.httpProvider) {
			await this.httpProvider.stop();
		}

		await super.stop();
	}

	async getInstance(): Promise<IUIFederationService> {
		return {
			registerUIModule: this.registerUIModule.bind(this),
			unregisterUIModule: this.unregisterUIModule.bind(this),
			getImportMap: this.getImportMap.bind(this),
			generateAstroConfig: this.generateAstroConfig.bind(this),
			buildUIModule: this.buildUIModule.bind(this),
			refreshAllImportMaps: this.refreshAllImportMaps.bind(this),
			getStats: this.getStats.bind(this),
		};
	}

	/**
	 * Registra un módulo UI y ejecuta su build
	 */
	async registerUIModule(name: string, appDir: string, config: UIModuleConfig): Promise<void> {
		this.logger.logInfo(`Registrando módulo UI: ${name}`);

		const module: RegisteredUIModule = {
			name,
			appDir,
			config,
			registeredAt: Date.now(),
			buildStatus: "pending",
		};

		this.registeredModules.set(name, module);

		try {
			// Generar astro.config.mjs (solo para framework Astro)
			const framework = config.framework || "astro";
			if (framework === "astro") {
				const configPath = await this.generateAstroConfig(appDir, config);
				this.logger.logDebug(`Configuración de Astro generada: ${configPath}`);
			}

			// Ejecutar build
			await this.buildUIModule(name);

			// Inyectar import maps en HTMLs
			await this.#injectImportMapsInHTMLs(name);

			// Actualizar import map
			this.#updateImportMap();

			// Registrar archivos estáticos en el servidor HTTP
			if (this.httpProvider && module.outputPath) {
				const urlPath = `/ui/${name}`;
				this.httpProvider.serveStatic(urlPath, module.outputPath);
				this.logger.logOk(`Módulo UI ${name} servido en ${urlPath}`);
			}
		} catch (error: any) {
			module.buildStatus = "error";
			this.logger.logError(`Error registrando módulo UI ${name}: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Desregistra un módulo UI
	 */
	async unregisterUIModule(name: string): Promise<void> {
		this.logger.logInfo(`Desregistrando módulo UI: ${name}`);

		const module = this.registeredModules.get(name);
		if (!module) {
			this.logger.logWarn(`Módulo UI ${name} no encontrado`);
			return;
		}

		// Eliminar del registro
		this.registeredModules.delete(name);

		// Actualizar import map
		this.#updateImportMap();

		this.logger.logOk(`Módulo UI ${name} desregistrado`);
	}

	/**
	 * Obtiene el import map actual
	 */
	getImportMap(): ImportMap {
		return this.importMap;
	}

	/**
	 * Genera el archivo astro.config.mjs para una app
	 */
	async generateAstroConfig(appDir: string, config: UIModuleConfig): Promise<string> {
		const outputDir = config.outputDir || "dist-ui";
		const astroDefaults = this.options?.astroDefaults || {
			output: "static",
			build: { format: "file" },
		};

		// Determinar qué integraciones necesitamos
		const sharedLibs = config.sharedLibs || [];
		const needsReact = sharedLibs.includes("react");
		const needsVue = sharedLibs.includes("vue");

		// Generar imports
		const imports: string[] = ["import { defineConfig } from 'astro/config';"];
		const integrations: string[] = [];

		if (needsReact) {
			imports.push("import react from '@astrojs/react';");
			integrations.push("react()");
		}
		if (needsVue) {
			imports.push("import vue from '@astrojs/vue';");
			integrations.push("vue()");
		}

		// Merge con configuración personalizada si existe
		const finalConfig = {
			...astroDefaults,
			...(config.astroConfig || {}),
			outDir: `./${outputDir}`,
		};

		// Construir el config content
		const configContentParts: string[] = [
			`// Auto-generado por UIFederationService`,
			imports.join('\n'),
			``,
			`export default defineConfig({`,
			`  output: "${finalConfig.output}",`,
			`  outDir: "${finalConfig.outDir}",`,
		];

		// Agregar configuración de build
		const buildConfig = {
			...(finalConfig.build || {}),
			format: "directory",
		};
		
		configContentParts.push(`  build: ${JSON.stringify(buildConfig)},`);

		if (integrations.length > 0) {
			configContentParts.push(`  integrations: [${integrations.join(', ')}],`);
		}

		configContentParts.push(`});`);
		
		const configContent = configContentParts.join('\n');

		const configPath = path.join(appDir, "astro.config.mjs");
		await fs.writeFile(configPath, configContent, "utf-8");

		return configPath;
	}

	/**
	 * Ejecuta el build del módulo UI directamente (sin npm scripts)
	 */
	async buildUIModule(name: string): Promise<void> {
		const module = this.registeredModules.get(name);
		if (!module) {
			throw new Error(`Módulo UI ${name} no encontrado`);
		}

		module.buildStatus = "building";
		this.logger.logInfo(`Ejecutando build para ${name}...`);

		try {
			const framework = module.config.framework || "astro";
			const rootDir = path.resolve(process.cwd());
			const viteBin = path.join(rootDir, "node_modules", ".bin", "vite");
			const astroBin = path.join(rootDir, "node_modules", ".bin", "astro");

			// Ejecutar build según framework usando binarios del root
			if (framework === "vite") {
				await this.#runCommand(viteBin, ["build"], module.appDir);
			} else if (framework === "astro") {
				await this.#runCommand(astroBin, ["build"], module.appDir);
			} else {
				throw new Error(`Framework no soportado: ${framework}`);
			}

			// Copiar output a ubicación servible
			const sourceOutputDir = path.join(module.appDir, module.config.outputDir);
			const targetOutputDir = path.join(this.uiOutputBaseDir, name);

			// Eliminar directorio anterior si existe
			await fs.rm(targetOutputDir, { recursive: true, force: true });

			// Copiar nuevo build
			await this.#copyDirectory(sourceOutputDir, targetOutputDir);

			module.outputPath = targetOutputDir;
			module.buildStatus = "built";

			this.logger.logOk(`Build completado para ${name}`);
		} catch (error: any) {
			module.buildStatus = "error";
			this.logger.logError(`Error en build de ${name}: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Reinyecta import maps en todos los módulos registrados
	 * Útil para actualizar los import maps después de que todos los módulos estén construidos
	 */
	async refreshAllImportMaps(): Promise<void> {
		this.logger.logInfo("Reinyectando import maps en todos los módulos...");
		
		for (const [name, module] of this.registeredModules.entries()) {
			if (module.buildStatus === "built" && module.outputPath) {
				await this.#injectImportMapsInHTMLs(name);
			}
		}
		
		this.#updateImportMap();
		this.logger.logOk("Import maps actualizados en todos los módulos");
	}

	/**
	 * Obtiene estadísticas del servicio
	 */
	getStats(): { registeredModules: number; importMapEntries: number; modules: RegisteredUIModule[] } {
		return {
			registeredModules: this.registeredModules.size,
			importMapEntries: Object.keys(this.importMap.imports).length,
			modules: Array.from(this.registeredModules.values()),
		};
	}

	/**
	 * Configura el endpoint del import map
	 */
	async #setupImportMapEndpoint(): Promise<void> {
		if (!this.httpProvider) return;

		// Registrar la ruta usando el método del provider
		this.httpProvider.registerRoute("GET", "/importmap.json", (req, res) => {
			res.setHeader("Content-Type", "application/json");
			res.json(this.importMap);
		});

		this.logger.logDebug("Endpoint /importmap.json registrado");
	}

	/**
	 * Genera el import map completo con todas las dependencias
	 */
	#generateCompleteImportMap(): Record<string, string> {
		const imports: Record<string, string> = {
			// React y sus exports
			"react": "https://esm.sh/react@18.3.1",
			"react-dom": "https://esm.sh/react-dom@18.3.1",
			"react-dom/client": "https://esm.sh/react-dom@18.3.1/client",
			"react/jsx-runtime": "https://esm.sh/react@18.3.1/jsx-runtime",
			"react/jsx-dev-runtime": "https://esm.sh/react@18.3.1/jsx-dev-runtime",
		};

		// Agregar TODOS los módulos UI registrados (sin importar su buildStatus)
		// Esto asegura que todos los import maps tengan todas las rutas necesarias
		for (const [name, module] of this.registeredModules.entries()) {
			const framework = module.config.framework || "astro";
			
			if (framework === "vite") {
				imports[`@${name}/`] = `/ui/${name}/`;
			} else {
				imports[`@${name}`] = `/ui/${name}/index.html`;
				imports[`@${name}/`] = `/ui/${name}/`;
			}
		}

		return imports;
	}

	/**
	 * Inyecta import maps en todos los archivos HTML de un módulo
	 */
	async #injectImportMapsInHTMLs(moduleName: string): Promise<void> {
		const module = this.registeredModules.get(moduleName);
		if (!module || !module.outputPath) return;

		const importMap = this.#generateCompleteImportMap();
		const importMapScript = `<script type="importmap">
${JSON.stringify({ imports: importMap }, null, 2)}
</script>`;

		// Buscar todos los archivos HTML en el output
		await this.#processHTMLFiles(module.outputPath, async (htmlPath, content) => {
			// Si ya tiene un import map, reemplazarlo; si no, agregarlo
			if (content.includes('<script type="importmap">')) {
				// Reemplazar import map existente
				content = content.replace(
					/<script type="importmap">[\s\S]*?<\/script>/,
					importMapScript
				);
			} else {
				// Inyectar antes del </head>
				content = content.replace(
					'</head>',
					`${importMapScript}\n</head>`
				);
			}

			await fs.writeFile(htmlPath, content, 'utf-8');
		});

		this.logger.logDebug(`Import maps inyectados en HTMLs de ${moduleName}`);
	}

	/**
	 * Procesa todos los archivos HTML en un directorio recursivamente
	 */
	async #processHTMLFiles(
		dir: string,
		callback: (filePath: string, content: string) => Promise<void>
	): Promise<void> {
		const entries = await fs.readdir(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);

			if (entry.isDirectory()) {
				await this.#processHTMLFiles(fullPath, callback);
			} else if (entry.isFile() && entry.name.endsWith('.html')) {
				const content = await fs.readFile(fullPath, 'utf-8');
				await callback(fullPath, content);
			}
		}
	}

	/**
	 * Actualiza el import map con los módulos registrados
	 */
	#updateImportMap(): void {
		this.importMap = { imports: this.#generateCompleteImportMap() };
		this.logger.logDebug(`Import map actualizado con ${Object.keys(this.importMap.imports).length} entradas`);
	}

	/**
	 * Ejecuta un comando en un directorio específico
	 */
	async #runCommand(command: string, args: string[], cwd: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const process = spawn(command, args, {
				cwd,
				stdio: "pipe",
				shell: false, // No usar shell para que los errores se propaguen correctamente
			});

			let output = "";
			let errorOutput = "";

			process.stdout?.on("data", (data) => {
				output += data.toString();
			});

			process.stderr?.on("data", (data) => {
				errorOutput += data.toString();
			});

			process.on("close", (code) => {
				if (code === 0) {
					// Mostrar output incluso si el comando tuvo éxito para debug
					if (output) {
						this.logger.logDebug(`Build output: ${output.slice(-200)}`);
					}
					resolve();
				} else {
					this.logger.logError(`Comando falló con código ${code}`);
					this.logger.logError(`Directorio: ${cwd}`);
					this.logger.logError(`Comando: ${command} ${args.join(" ")}`);
					if (output) {
						this.logger.logError(`Stdout: ${output.slice(0, 1000)}`);
					}
					if (errorOutput) {
						this.logger.logError(`Stderr: ${errorOutput.slice(0, 1000)}`);
					}
					reject(new Error(`Comando falló: ${command} ${args.join(" ")}`));
				}
			});

			process.on("error", (error) => {
				this.logger.logError(`Error ejecutando comando: ${error.message}`);
				reject(error);
			});
		});
	}

	/**
	 * Copia recursivamente un directorio
	 */
	async #copyDirectory(source: string, target: string): Promise<void> {
		await fs.mkdir(target, { recursive: true });

		const entries = await fs.readdir(source, { withFileTypes: true });

		for (const entry of entries) {
			const sourcePath = path.join(source, entry.name);
			const targetPath = path.join(target, entry.name);

			if (entry.isDirectory()) {
				await this.#copyDirectory(sourcePath, targetPath);
			} else {
				await fs.copyFile(sourcePath, targetPath);
			}
		}
	}
}

// Re-exportar tipos
export type { IUIFederationService, RegisteredUIModule } from "./types.js";

