/** Tipos de valor soportados por un custom field del proyecto. */
export type CustomFieldType = "date" | "label" | "text" | "user" | "number";

/**
 * Definición de un custom field disponible a nivel de proyecto.
 * Los valores por issue se guardan en `Issue.customFields: Record<fieldId, value>`.
 */
export interface CustomFieldDef {
	id: string;
	name: string;
	type: CustomFieldType;
	/** Solo aplica cuando `type = "label"`. */
	options?: string[];
	required?: boolean;
}

/** Valor serializable por tipo. */
export type CustomFieldValue = string | number | Date | null;
