import type { LabelColor } from "./LabelColors.ts";

/** Label definido a nivel de proyecto, referenciado por issues via id. */
export interface ProjectLabel {
	id: string;
	name: string;
	color: LabelColor;
}
