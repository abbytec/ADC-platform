import { ILifecycle } from "../behaviours/ILifecycle.d.ts";

/**
 * Configuración de un módulo en modules.json
 */
export interface IModuleConfig {
	/** Nombre del módulo */
	name: string;
	/** Tipo de módulo */
	type?: string;
	/** Versión a cargar - puede ser exacta (1.0.0) o con rango (^1.0.0, >=1.0.0) */
	version?: string;
	/** Si es `true`, la configuración del módulo se considerará global y estará disponible en submódulos */
	global?: boolean;
	/** Lenguaje del módulo (default: 'typescript') */
	language?: string;
	/** Configuración personalizada para pasar al constructor del módulo */
	config?: Record<string, any>;
	/** Providers que este módulo necesita como dependencias */
	providers?: IModuleConfig[];
	/** Utilities que este módulo necesita como dependencias */
	utilities?: IModuleConfig[];
}

/**
 * Definición de los módulos requeridos por una app
 */
export interface IModulesDefinition {
	/** Si true, los errores al cargar módulos no detendrán la app */
	failOnError?: boolean;
	/** Lista de services a cargar */
	services?: IModuleConfig[];
	/** Lista de utilities a cargar */
	utilities?: IModuleConfig[];
	/** Lista de providers a cargar */
	providers?: IModuleConfig[];
}

export interface IModule extends ILifecycle {
	readonly name: string;
}
