interface ResourceHeaderProps {
	readonly resource: string;
	readonly onRemove: (r: string) => void;
	readonly disabled?: boolean;
	readonly t: (k: string) => string;
}

export function ResourceHeader({ resource, onRemove, disabled, t }: ResourceHeaderProps) {
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
