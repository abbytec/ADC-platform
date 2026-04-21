import type { LabelColor } from "./LabelColors.ts";

/** Tipos de valor soportados por un custom field del proyecto. */
export type CustomFieldType = "date" | "label" | "text" | "user" | "number" | "badge";

/** Opción coloreada para un custom field de tipo `badge`. */
export interface BadgeOption {
	name: string;
	color: LabelColor;
}

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
	/** Solo aplica cuando `type = "badge"`. Opciones con color. */
	badgeOptions?: BadgeOption[];
	required?: boolean;
}

/** Valor serializable por tipo. `string[]` corresponde a `badge` (multi-selección). */
export type CustomFieldValue = string | number | Date | string[] | null;
