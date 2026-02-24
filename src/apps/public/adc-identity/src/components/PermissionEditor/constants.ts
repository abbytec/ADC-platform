/**
 * Action bitfield values (used for bitfield-based resources like identity)
 */
export const ACTIONS = [
	{ key: "read", value: 1, label: "permissions.read" },
	{ key: "write", value: 2, label: "permissions.write" },
	{ key: "update", value: 4, label: "permissions.update" },
	{ key: "delete", value: 8, label: "permissions.delete" },
] as const;

/** Action lookup by key (for simple toggle) */
export const ACTION_MAP = new Map<string, number>(ACTIONS.map((a) => [a.key, a.value]));
