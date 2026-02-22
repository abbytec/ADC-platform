import { useMemo } from "react";
import { useTranslation } from "@ui-library/utils/i18n-react";
import type { Permission } from "../utils/identity-api.ts";

/**
 * Action bitfield values
 */
const ACTIONS = [
	{ key: "read", value: 1, label: "permissions.read" },
	{ key: "write", value: 2, label: "permissions.write" },
	{ key: "update", value: 4, label: "permissions.update" },
	{ key: "delete", value: 8, label: "permissions.delete" },
] as const;

/**
 * Scope bitfield values for the identity resource
 */
const SCOPES = [
	{ key: "self", value: 1, label: "permissions.self" },
	{ key: "users", value: 2, label: "permissions.users" },
	{ key: "roles", value: 4, label: "permissions.roles" },
	{ key: "groups", value: 8, label: "permissions.groups" },
	{ key: "organizations", value: 16, label: "permissions.organizations" },
	{ key: "regions", value: 32, label: "permissions.regions" },
	{ key: "stats", value: 64, label: "permissions.stats" },
] as const;

const RESOURCE = "identity";

interface PermissionEditorProps {
	readonly permissions: Permission[];
	readonly onChange: (permissions: Permission[]) => void;
	readonly disabled?: boolean;
}

/**
 * Builds a lookup map from permissions array: scope → combined action bitfield
 */
function buildPermissionMap(permissions: Permission[]): Map<number, number> {
	const map = new Map<number, number>();
	for (const perm of permissions) {
		if (perm.resource !== RESOURCE) continue;
		// Each permission entry has its own scope+action combination
		// Merge actions for same scope
		const existing = map.get(perm.scope) ?? 0;
		map.set(perm.scope, existing | perm.action);
	}
	return map;
}

/**
 * Converts the permission map back to a Permission[] array
 */
function mapToPermissions(scopeActions: Map<number, number>): Permission[] {
	const result: Permission[] = [];
	for (const [scope, action] of scopeActions) {
		if (action > 0) {
			result.push({ resource: RESOURCE, action, scope });
		}
	}
	return result;
}

/**
 * Visual permission editor with a scope × action checkbox matrix
 */
export function PermissionEditor({ permissions, onChange, disabled }: PermissionEditorProps) {
	const { t } = useTranslation({ namespace: "adc-identity", autoLoad: true });

	const permMap = useMemo(() => buildPermissionMap(permissions), [permissions]);

	const isChecked = (scopeValue: number, actionValue: number): boolean => {
		const actions = permMap.get(scopeValue) ?? 0;
		return (actions & actionValue) === actionValue;
	};

	const toggle = (scopeValue: number, actionValue: number) => {
		if (disabled) return;
		const updated = new Map(permMap);
		const current = updated.get(scopeValue) ?? 0;
		if ((current & actionValue) === actionValue) {
			// Remove action
			updated.set(scopeValue, current & ~actionValue);
		} else {
			// Add action
			updated.set(scopeValue, current | actionValue);
		}
		onChange(mapToPermissions(updated));
	};

	const toggleScopeRow = (scopeValue: number) => {
		if (disabled) return;
		const updated = new Map(permMap);
		const current = updated.get(scopeValue) ?? 0;
		const allActions = ACTIONS.reduce((acc, a) => acc | a.value, 0); // 15 = CRUD
		if (current === allActions) {
			updated.set(scopeValue, 0);
		} else {
			updated.set(scopeValue, allActions);
		}
		onChange(mapToPermissions(updated));
	};

	const toggleActionColumn = (actionValue: number) => {
		if (disabled) return;
		const updated = new Map(permMap);
		const allHaveAction = SCOPES.every((s) => ((updated.get(s.value) ?? 0) & actionValue) === actionValue);
		for (const scope of SCOPES) {
			const current = updated.get(scope.value) ?? 0;
			if (allHaveAction) {
				updated.set(scope.value, current & ~actionValue);
			} else {
				updated.set(scope.value, current | actionValue);
			}
		}
		onChange(mapToPermissions(updated));
	};

	return (
		<div className="overflow-x-auto border border-surface rounded-xl">
			<table className="w-full text-xs">
				<thead>
					<tr className="bg-surface/50 border-b border-surface">
						<th className="px-3 py-2 text-left font-heading font-semibold text-text">{t("permissions.scope")}</th>
						{ACTIONS.map((action) => (
							<th key={action.key} className="px-3 py-2 text-center font-heading font-semibold text-text">
								<button
									type="button"
									className="cursor-pointer hover:text-primary transition-colors"
									onClick={() => toggleActionColumn(action.value)}
									disabled={disabled}
									title={t("permissions.toggleAll")}
								>
									{t(action.label)}
								</button>
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{SCOPES.map((scope) => {
						const rowActions = permMap.get(scope.value) ?? 0;
						const allActions = ACTIONS.reduce((acc, a) => acc | a.value, 0);
						const allChecked = rowActions === allActions;

						return (
							<tr key={scope.key} className="border-b border-surface/50 hover:bg-surface/20 transition-colors">
								<td className="px-3 py-2 font-medium text-text">
									<button
										type="button"
										className={`cursor-pointer transition-colors ${allChecked ? "text-primary font-semibold" : "hover:text-primary"}`}
										onClick={() => toggleScopeRow(scope.value)}
										disabled={disabled}
										title={t("permissions.toggleRow")}
									>
										{t(scope.label)}
									</button>
								</td>
								{ACTIONS.map((action) => (
									<td key={action.key} className="px-3 py-2 text-center">
										<input
											type="checkbox"
											checked={isChecked(scope.value, action.value)}
											onChange={() => toggle(scope.value, action.value)}
											disabled={disabled}
											className="w-4 h-4 accent-primary cursor-pointer"
										/>
									</td>
								))}
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
