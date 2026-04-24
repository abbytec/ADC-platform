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
		<div className="border border-accent/20 rounded-xl overflow-hidden">
			<ResourceHeader resource={resource} onRemove={onRemove} disabled={disabled} t={t} />
			<div className="flex flex-wrap gap-4 px-4 py-3">
				{ACTIONS.map((action) => (
					<adc-checkbox
						key={action.key}
						checked={activeActions.has(action.key)}
						disabled={disabled}
						label={t(action.label)}
						onChange={() => onToggle(resource, action.key)}
					/>
				))}
			</div>
		</div>
	);
}
