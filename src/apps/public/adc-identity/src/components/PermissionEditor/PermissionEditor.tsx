import { useMemo, useState, useCallback } from "react";
import { useTranslation } from "@ui-library/utils/i18n-react";
import type { Permission } from "../../utils/identity-api.ts";
import { RESOURCES, RESOURCE_MAP, type ScopeDef } from "@common/types/resources.js";
import { ACTIONS, ACTION_MAP } from "./constants.ts";
import { buildBitfieldMap, bitfieldMapToPermissions, getSimpleActions } from "./helpers.ts";
import { SimpleResourceCard } from "./SimpleResourceCard.tsx";
import { ResourceMatrix } from "./ResourceMatrix.tsx";

interface PermissionEditorProps {
	readonly permissions: Permission[];
	readonly onChange: (permissions: Permission[]) => void;
	readonly disabled?: boolean;
}

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
