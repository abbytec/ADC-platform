import { ACTIONS } from "./constants.ts";
import { ResourceHeader } from "./ResourceHeader.tsx";
import type { ScopeDef } from "@common/types/resources.js";

interface ResourceMatrixProps {
	readonly resource: string;
	readonly scopes: ScopeDef[];
	readonly permMap: Map<string, number>;
	readonly onToggle: (resource: string, scope: number, action: number) => void;
	readonly onToggleRow: (resource: string, scope: number) => void;
	readonly onToggleCol: (resource: string, scopes: ScopeDef[], action: number) => void;
	readonly onRemove: (resource: string) => void;
	readonly disabled?: boolean;
	readonly t: (k: string) => string;
}

export function ResourceMatrix({ resource, scopes, permMap, onToggle, onToggleRow, onToggleCol, onRemove, disabled, t }: ResourceMatrixProps) {
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
