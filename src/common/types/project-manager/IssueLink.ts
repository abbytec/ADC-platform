import type { LabelColor } from "./LabelColors.ts";

/** Tipo de vínculo entre issues definido a nivel de proyecto. */
export interface IssueLinkType {
	id: string;
	/** Nombre directo (ej. "blocks", "duplicates"). */
	name: string;
	/** Nombre inverso para el target (ej. "blocked by", "duplicated by"). */
	inverseName: string;
	color: LabelColor;
}

/** Vínculo persistido en un issue apuntando a otro issue. */
export interface IssueLink {
	linkTypeId: string;
	targetIssueId: string;
}
