/**
 * Metadata de un attachment asociado a un issue.
 * En Fase 1 es read-only: el upload real requiere `internal-s3-provider`.
 */
export interface IssueAttachment {
	id: string;
	fileName: string;
	mimeType: string;
	size: number;
	/** Clave en el storage (apunta a internal-s3-provider cuando exista). */
	storageKey: string;
	uploadedBy: string;
	uploadedAt: Date;
}
