import { ipcManager } from "../ipc/IPCManager.js";
import { Logger } from "../logger/Logger.js";
import { Worker } from "node:worker_threads";

/**
 * Configuración para el proxy de interoperabilidad
 */
export interface ProxyConfig {
	/** Nombre del módulo */
	moduleName: string;
	/** Versión del módulo */
	moduleVersion: string;
	/** Lenguaje del módulo */
	language?: string;
	/** Worker asignado (para ejecución paralela en TypeScript) */
	worker?: Worker | null;
}

/**
 * Símbolo para almacenar la configuración del proxy en la instancia
 */
const PROXY_CONFIG = Symbol("proxyConfig");

/**
 * Símbolo para indicar que una clase ya está proxied
 */
const IS_PROXIED = Symbol("isProxied");

/**
 * Decorador @Proxied para clases que necesitan interoperabilidad cross-language o workers.
 * 
 * Este decorador crea un proxy transparente que intercepta todas las llamadas a métodos
 * y decide automáticamente cómo ejecutarlas:
 * 
 * 1. Si la instancia tiene un config con lenguaje diferente a TypeScript, las llamadas
 *    se enrutan mediante IPC (named pipes) al proceso del módulo en ese lenguaje.
 * 
 * 2. Si la instancia tiene un worker asignado (solo en TypeScript), las llamadas se
 *    ejecutan en el worker para procesamiento paralelo.
 * 
 * 3. Si ninguna de las condiciones anteriores se cumple, las llamadas se ejecutan
 *    normalmente en el proceso actual.
 * 
 * @example
 * ```typescript
 * @Proxied
 * class MyUtility extends BaseUtility<SomeType> {
 *   readonly name = "my-utility";
 *   
 *   constructor(config?: any) {
 *     super();
 *     // El decorador automáticamente detectará si config.language !== 'typescript'
 *   }
 *   
 *   async myMethod(arg: string): Promise<string> {
 *     // Esta llamada puede ejecutarse local, en IPC, o en un worker
 *     return `Processed: ${arg}`;
 *   }
 * }
 * ```
 */
export function Proxied<T extends new (...args: any[]) => any>(constructor: T): T {
	// Verificar que no se aplique el decorador dos veces
	if ((constructor as any)[IS_PROXIED]) {
		Logger.warn(`[Proxied] La clase ${constructor.name} ya está proxied, ignorando decorador duplicado`);
		return constructor;
	}

	// Marcar la clase como proxied
	(constructor as any)[IS_PROXIED] = true;

	return class extends constructor {
		constructor(...args: any[]) {
			super(...args);

			// Extraer la configuración del primer argumento si existe
			const config = args[0] as ProxyConfig | undefined;
			
			// Si hay configuración, guardarla en la instancia
			if (config) {
				(this as any)[PROXY_CONFIG] = {
					moduleName: config.moduleName || (this as any).name || "unknown",
					moduleVersion: config.moduleVersion || "latest",
					language: config.language || "typescript",
					worker: config.worker || null,
				};
			}

			// Crear el proxy para interceptar las llamadas
			return this.#createProxy();
		}

		/**
		 * Crea un proxy que intercepta todas las llamadas a métodos
		 */
		#createProxy(): any {
			const self = this;
			const proxyConfig: ProxyConfig | undefined = (this as any)[PROXY_CONFIG];

			return new Proxy(this, {
				get(target: any, prop: string | symbol, receiver: any) {
					const originalValue = Reflect.get(target, prop, receiver);

					// Si no es una función o es un símbolo, devolver el valor original
					if (typeof originalValue !== "function" || typeof prop === "symbol") {
						return originalValue;
					}

					// Si no hay configuración de proxy, ejecutar normalmente
					if (!proxyConfig) {
						return originalValue;
					}

					// Métodos especiales que no deben ser interceptados
					const skipMethods = ["constructor", "start", "stop", "getInstance"];
					if (skipMethods.includes(prop)) {
						return originalValue;
					}

					// Crear la función interceptada
					return function (this: any, ...args: any[]) {
						return self.#handleMethodCall(proxyConfig, prop, args, originalValue, target);
					};
				},

				set(target: any, prop: string | symbol, value: any, receiver: any) {
					// Permitir la asignación de un worker en runtime
					if (prop === "worker") {
						if (proxyConfig) {
							proxyConfig.worker = value;
						}
						return true;
					}

					return Reflect.set(target, prop, value, receiver);
				},
			});
		}

		/**
		 * Maneja la llamada a un método decidiendo cómo ejecutarlo
		 */
		async #handleMethodCall(
			config: ProxyConfig,
			method: string,
			args: any[],
			originalMethod: Function,
			target: any
		): Promise<any> {
			// CASO A: Si el lenguaje es diferente a TypeScript, usar IPC
			if (config.language && config.language !== "typescript") {
				Logger.debug(
					`[Proxied] Llamando método '${method}' via IPC: ${config.moduleName}@${config.moduleVersion} (${config.language})`
				);

				try {
					return await ipcManager.call(config.moduleName, config.moduleVersion, config.language, method, args);
				} catch (error: any) {
					Logger.error(`[Proxied] Error en llamada IPC a '${method}': ${error.message}`);
					throw error;
				}
			}

			// CASO B: Si hay un worker asignado, ejecutar en el worker
			if (config.worker) {
				Logger.debug(`[Proxied] Llamando método '${method}' en worker: ${config.moduleName}`);

				return new Promise((resolve, reject) => {
					const messageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

					// Listener para la respuesta del worker
					const messageHandler = (message: any) => {
						if (message && message.id === messageId) {
							config.worker!.off("message", messageHandler);

							if (message.type === "response") {
								resolve(message.result);
							} else if (message.type === "error") {
								reject(new Error(message.error));
							}
						}
					};

					// Listener para errores del worker
					const errorHandler = (error: Error) => {
						config.worker!.off("message", messageHandler);
						config.worker!.off("error", errorHandler);
						reject(error);
					};

					config.worker!.on("message", messageHandler);
					config.worker!.on("error", errorHandler);

					// Enviar el mensaje al worker
					config.worker!.postMessage({
						id: messageId,
						type: "request",
						method,
						args,
					});

					// Timeout de 30 segundos
					setTimeout(() => {
						config.worker!.off("message", messageHandler);
						config.worker!.off("error", errorHandler);
						reject(new Error(`Timeout esperando respuesta del worker para método '${method}'`));
					}, 30000);
				});
			}

			// CASO DEFAULT: Ejecutar normalmente en el proceso actual
			return originalMethod.apply(target, args);
		}
	} as T;
}

/**
 * Asigna un worker a una instancia proxied en runtime
 */
export function assignWorker(instance: any, worker: Worker | null): void {
	instance.worker = worker;
}

/**
 * Obtiene la configuración del proxy de una instancia
 */
export function getProxyConfig(instance: any): ProxyConfig | undefined {
	return instance[PROXY_CONFIG];
}

