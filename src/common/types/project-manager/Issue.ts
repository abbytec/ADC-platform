import type { IssueLink } from "./IssueLink.ts";
import type { IssueAttachment } from "./Attachment.ts";
import type { UpdateLogEntry } from "./UpdateLogEntry.ts";
import type { CustomFieldValue } from "./CustomField.ts";

/** Categoría/tipo de trabajo del issue. Configurable por proyecto. */
export type IssueCategory = "task" | "bug" | "story" | "epic" | (string & {});

/** Urgencia/importancia: 0..4 (none, low, medium, high, critical). */
export type UrgencyImportance = 0 | 1 | 2 | 3 | 4;

/** Dificultad 1..5. `null` = sin estimar. */
export type Difficulty = 1 | 2 | 3 | 4 | 5 | null;

export interface IssuePriority {
	urgency: UrgencyImportance;
	importance: UrgencyImportance;
	difficulty: Difficulty;
}

export interface Issue {
	id: string;
	projectId: string;
	/** Key human-readable tipo `PROJ-123`. */
	key: string;

	title: string;
	/** Markdown. */
	description: string;

	columnKey: string;
	category: IssueCategory;

	sprintId?: string;
	milestoneId?: string;

	reporterId: string;
	assigneeIds: string[];
	assigneeGroupIds: string[];

	priority: IssuePriority;
	storyPoints?: number;

	customFields: Record<string, CustomFieldValue>;
	linkedIssues: IssueLink[];
	attachments: IssueAttachment[];

	updateLog: UpdateLogEntry[];

	createdAt: Date;
	updatedAt: Date;
	closedAt?: Date;
}
