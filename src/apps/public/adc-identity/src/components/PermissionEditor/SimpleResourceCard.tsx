import { ACTIONS } from "./constants.ts";
import { ResourceHeader } from "./ResourceHeader.tsx";

interface SimpleResourceCardProps {
	readonly resource: string;
	readonly activeActions: Set<string>;
	readonly onToggle: (resource: string, action: string) => void;
	readonly onRemove: (resource: string) => void;
	readonly disabled?: boolean;
	readonly t: (k: string) => string;
}

export function SimpleResourceCard({ resource, activeActions, onToggle, onRemove, disabled, t }: SimpleResourceCardProps) {
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
