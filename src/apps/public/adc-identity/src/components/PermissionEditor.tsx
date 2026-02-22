import { useMemo, useState, useCallback } from "react";
import { useTranslation } from "@ui-library/utils/i18n-react";
import type { Permission } from "../utils/identity-api.ts";
import { RESOURCES, RESOURCE_MAP, type ScopeDef } from "@common/types/resources.js";

/**
 * Action bitfield values (used for bitfield-based resources like identity)
 */
const ACTIONS = [
	{ key: "read", value: 1, label: "permissions.read" },
	{ key: "write", value: 2, label: "permissions.write" },
	{ key: "update", value: 4, label: "permissions.update" },
	{ key: "delete", value: 8, label: "permissions.delete" },
] as const;

/** Action lookup by key (for simple toggle) */
const ACTION_MAP = new Map<string, number>(ACTIONS.map((a) => [a.key, a.value]));

interface PermissionEditorProps {
	readonly permissions: Permission[];
	readonly onChange: (permissions: Permission[]) => void;
	readonly disabled?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bitfield helpers (identity-style: resource.scope.action)
// ─────────────────────────────────────────────────────────────────────────────

function buildBitfieldMap(permissions: Permission[]): Map<string, number> {
	const map = new Map<string, number>();
	for (const perm of permissions) {
		const key = `${perm.resource}:${perm.scope}`;
		map.set(key, (map.get(key) ?? 0) | perm.action);
	}
	return map;
}

function bitfieldMapToPermissions(permMap: Map<string, number>): Permission[] {
	const result: Permission[] = [];
	for (const [key, action] of permMap) {
		if (action > 0) {
			const [resource, scopeStr] = key.split(":");
			result.push({ resource, action, scope: Number(scopeStr) });
		}
	}
	return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Simple helpers (content-style: resource.action as string)
// ─────────────────────────────────────────────────────────────────────────────

function getSimpleActions(permissions: Permission[], resource: string): Set<string> {
	const set = new Set<string>();
	for (const p of permissions) {
		if (p.resource === resource) {
			for (const a of ACTIONS) {
				if ((p.action & a.value) === a.value) set.add(a.key);
			}
		}
	}
	return set;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resource header (shared)
// ─────────────────────────────────────────────────────────────────────────────

function ResourceHeader({
	resource,
	onRemove,
	disabled,
	t,
}: {
	resource: string;
	onRemove: (r: string) => void;
	disabled?: boolean;
	t: (k: string) => string;
}) {
	return (
		<div className="flex items-center justify-between bg-surface/30 px-3 py-1.5 border-b border-surface">
			<span className="text-xs font-heading font-semibold text-text">{t(`resources.${resource}`)}</span>
			{!disabled && (
				<button
					type="button"
					className="text-[10px] text-tdanger hover:text-danger transition-colors cursor-pointer"
					onClick={() => onRemove(resource)}
					title={t("permissions.removeResource")}
				>
					✕
				</button>
			)}
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Simple resource row (content-style: just action checkboxes)
// ─────────────────────────────────────────────────────────────────────────────

function SimpleResourceCard({
	resource,
	activeActions,
	onToggle,
	onRemove,
	disabled,
	t,
}: {
	resource: string;
	activeActions: Set<string>;
	onToggle: (resource: string, action: string) => void;
	onRemove: (resource: string) => void;
	disabled?: boolean;
	t: (k: string) => string;
}) {
	return (
		<div className="border border-surface rounded-xl overflow-hidden">
			<ResourceHeader resource={resource} onRemove={onRemove} disabled={disabled} t={t} />
			<div className="flex flex-wrap gap-4 px-4 py-3">
				{ACTIONS.map((action) => (
					<label key={action.key} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
						<input
							type="checkbox"
							checked={activeActions.has(action.key)}
							onChange={() => onToggle(resource, action.key)}
							disabled={disabled}
							className="w-4 h-4 accent-primary cursor-pointer"
						/>
						<span className="text-text">{t(action.label)}</span>
					</label>
				))}
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Bitfield resource matrix (identity-style: scope × action)
// ─────────────────────────────────────────────────────────────────────────────

function ResourceMatrix({
	resource,
	scopes,
	permMap,
	onToggle,
	onToggleRow,
	onToggleCol,
	onRemove,
	disabled,
	t,
}: {
	resource: string;
	scopes: ScopeDef[];
	permMap: Map<string, number>;
	onToggle: (resource: string, scope: number, action: number) => void;
	onToggleRow: (resource: string, scope: number) => void;
	onToggleCol: (resource: string, scopes: ScopeDef[], action: number) => void;
	onRemove: (resource: string) => void;
	disabled?: boolean;
	t: (k: string) => string;
}) {
	const allActions = ACTIONS.reduce((acc, a) => acc | a.value, 0);

	return (
		<div className="border border-surface rounded-xl overflow-hidden">
			<ResourceHeader resource={resource} onRemove={onRemove} disabled={disabled} t={t} />
			<table className="w-full text-xs">
				<thead>
					<tr className="bg-surface/50 border-b border-surface">
						<th className="px-3 py-2 text-left font-heading font-semibold text-text">{t("permissions.scope")}</th>
						{ACTIONS.map((action) => (
							<th key={action.key} className="px-3 py-2 text-center font-heading font-semibold text-text">
								<button
									type="button"
									className="cursor-pointer hover:text-primary transition-colors"
									onClick={() => onToggleCol(resource, scopes, action.value)}
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
					{scopes.map((scope) => {
						const key = `${resource}:${scope.value}`;
						const rowActions = permMap.get(key) ?? 0;
						const allChecked = rowActions === allActions;
						return (
							<tr key={scope.key} className="border-b border-surface/50 hover:bg-surface/20 transition-colors">
								<td className="px-3 py-2 font-medium text-text">
									<button
										type="button"
										className={`cursor-pointer transition-colors ${allChecked ? "text-primary font-semibold" : "hover:text-primary"}`}
										onClick={() => onToggleRow(resource, scope.value)}
										disabled={disabled}
										title={t("permissions.toggleRow")}
									>
										{t(`permissions.${scope.key}`)}
									</button>
								</td>
								{ACTIONS.map((action) => (
									<td key={action.key} className="px-3 py-2 text-center">
										<input
											type="checkbox"
											checked={((permMap.get(key) ?? 0) & action.value) === action.value}
											onChange={() => onToggle(resource, scope.value, action.value)}
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

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function PermissionEditor({ permissions, onChange, disabled }: PermissionEditorProps) {
	const { t } = useTranslation({ namespace: "adc-identity", autoLoad: true });

	// Separate bitfield vs simple permissions
	const bitfieldPerms = useMemo(() => permissions.filter((p) => !RESOURCE_MAP.get(p.resource)?.simple), [permissions]);
	const simplePerms = useMemo(() => permissions.filter((p) => RESOURCE_MAP.get(p.resource)?.simple), [permissions]);

	const permMap = useMemo(() => buildBitfieldMap(bitfieldPerms), [bitfieldPerms]);

	// Track which resources are visible (have permissions OR were explicitly added)
	const [addedResources, setAddedResources] = useState<Set<string>>(new Set());
	const [addingResource, setAddingResource] = useState(false);

	const activeResources = useMemo(() => {
		const active = new Set<string>();
		for (const p of permissions) active.add(p.resource);
		for (const r of addedResources) active.add(r);
		return active;
	}, [permissions, addedResources]);

	// ── Bitfield callbacks ──

	const rebuildAll = useCallback(
		(nextBitfield: Map<string, number>, nextSimple?: Permission[]) => {
			const bf = bitfieldMapToPermissions(nextBitfield);
			onChange([...bf, ...(nextSimple ?? simplePerms)]);
		},
		[onChange, simplePerms]
	);

	const toggle = useCallback(
		(resource: string, scope: number, actionValue: number) => {
			if (disabled) return;
			const updated = new Map(permMap);
			const key = `${resource}:${scope}`;
			const current = updated.get(key) ?? 0;
			updated.set(key, (current & actionValue) === actionValue ? current & ~actionValue : current | actionValue);
			rebuildAll(updated);
		},
		[permMap, disabled, rebuildAll]
	);

	const toggleRow = useCallback(
		(resource: string, scope: number) => {
			if (disabled) return;
			const updated = new Map(permMap);
			const key = `${resource}:${scope}`;
			const current = updated.get(key) ?? 0;
			const allActs = ACTIONS.reduce((acc, a) => acc | a.value, 0);
			updated.set(key, current === allActs ? 0 : allActs);
			rebuildAll(updated);
		},
		[permMap, disabled, rebuildAll]
	);

	const toggleCol = useCallback(
		(resource: string, scopes: ScopeDef[], actionValue: number) => {
			if (disabled) return;
			const updated = new Map(permMap);
			const allHave = scopes.every((s) => ((updated.get(`${resource}:${s.value}`) ?? 0) & actionValue) === actionValue);
			for (const scope of scopes) {
				const key = `${resource}:${scope.value}`;
				const current = updated.get(key) ?? 0;
				updated.set(key, allHave ? current & ~actionValue : current | actionValue);
			}
			rebuildAll(updated);
		},
		[permMap, disabled, rebuildAll]
	);

	// ── Simple callbacks ──

	const toggleSimple = useCallback(
		(resource: string, actionKey: string) => {
			if (disabled) return;
			const actionValue = ACTION_MAP.get(actionKey) ?? 0;
			const existing = simplePerms.find((p) => p.resource === resource);
			const current = existing?.action ?? 0;
			const toggled = (current & actionValue) === actionValue ? current & ~actionValue : current | actionValue;
			const others = simplePerms.filter((p) => p.resource !== resource);
			const next = toggled > 0 ? [...others, { resource, action: toggled, scope: 0 }] : others;
			onChange([...bitfieldMapToPermissions(permMap), ...next]);
		},
		[disabled, simplePerms, permMap, onChange]
	);

	// ── Shared callbacks ──

	const removeResource = useCallback(
		(resource: string) => {
			const def = RESOURCE_MAP.get(resource);
			setAddedResources((prev) => {
				const n = new Set(prev);
				n.delete(resource);
				return n;
			});
			if (def?.simple) {
				const next = simplePerms.filter((p) => p.resource !== resource);
				onChange([...bitfieldMapToPermissions(permMap), ...next]);
			} else {
				const updated = new Map(permMap);
				for (const key of [...updated.keys()]) {
					if (key.startsWith(`${resource}:`)) updated.delete(key);
				}
				rebuildAll(updated);
			}
		},
		[permMap, simplePerms, onChange, rebuildAll]
	);

	const addResource = useCallback(
		(resourceId: string) => {
			setAddingResource(false);
			if (activeResources.has(resourceId)) return;
			setAddedResources((prev) => new Set(prev).add(resourceId));
		},
		[activeResources]
	);

	// ── Visible / available ──

	const visibleResources = useMemo(() => RESOURCES.filter((r) => activeResources.has(r.id)), [activeResources]);

	const availableResources = useMemo(() => RESOURCES.filter((r) => !activeResources.has(r.id)), [activeResources]);

	return (
		<div className="flex flex-col gap-3">
			{visibleResources.map((res) =>
				res.simple ? (
					<SimpleResourceCard
						key={res.id}
						resource={res.id}
						activeActions={getSimpleActions(simplePerms, res.id)}
						onToggle={toggleSimple}
						onRemove={removeResource}
						disabled={disabled}
						t={t}
					/>
				) : (
					<ResourceMatrix
						key={res.id}
						resource={res.id}
						scopes={res.scopes}
						permMap={permMap}
						onToggle={toggle}
						onToggleRow={toggleRow}
						onToggleCol={toggleCol}
						onRemove={removeResource}
						disabled={disabled}
						t={t}
					/>
				)
			)}

			{!disabled && availableResources.length > 0 && (
				<div>
					{addingResource ? (
						<div className="flex flex-wrap gap-2">
							{availableResources.map((r) => (
								<button
									key={r.id}
									type="button"
									className="px-3 py-1 text-xs rounded-lg border border-surface hover:border-primary hover:text-primary transition-colors cursor-pointer"
									onClick={() => addResource(r.id)}
								>
									{t(r.label)}
								</button>
							))}
							<button
								type="button"
								className="px-3 py-1 text-xs text-tmuted hover:text-text transition-colors cursor-pointer"
								onClick={() => setAddingResource(false)}
							>
								{t("permissions.cancel")}
							</button>
						</div>
					) : (
						<button
							type="button"
							className="px-3 py-1.5 text-xs rounded-lg border border-dashed border-surface hover:border-primary hover:text-primary transition-colors cursor-pointer"
							onClick={() => setAddingResource(true)}
						>
							+ {t("permissions.addResource")}
						</button>
					)}
				</div>
			)}
		</div>
	);
}
