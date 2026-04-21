import { useEffect, useState } from "react";
import { useTranslation } from "@ui-library/utils/i18n-react";
import { identityPmApi } from "../../utils/identity-api.ts";
import { ClientGroup } from "@common/types/identity/Group.ts";

interface Props {
	selectedIds: string[];
	onChange: (ids: string[]) => void;
	orgId?: string | null;
	disabled?: boolean;
	label?: string;
}

/**
 * Picker multi de grupos. Carga todos los grupos visibles al caller (opcionalmente
 * filtrados por org) y los muestra en un listado con checkboxes compactos.
 */
export function GroupPicker({ selectedIds, onChange, orgId, disabled, label }: Props) {
	const { t } = useTranslation({ namespace: "adc-project-manager" });
	const [groups, setGroups] = useState<ClientGroup[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			setLoading(true);
			const res = await identityPmApi.listGroups(orgId ?? undefined);
			if (!cancelled && res.success && res.data) setGroups(res.data);
			if (!cancelled) setLoading(false);
		})();
		return () => {
			cancelled = true;
		};
	}, [orgId]);

	const toggle = (id: string) => {
		if (selectedIds.includes(id)) onChange(selectedIds.filter((x) => x !== id));
		else onChange([...selectedIds, id]);
	};

	return (
		<div className="space-y-2">
			{label && <label className="block text-sm font-medium text-text">{label}</label>}
			{loading ? (
				<adc-skeleton variant="rectangular" height="80px" />
			) : groups.length === 0 ? (
				<p className="text-xs text-muted">{t("settings.noGroups")}</p>
			) : (
				<ul className="border border-text/15 rounded-md max-h-40 overflow-y-auto">
					{groups.map((g) => (
						<li key={g.id} className="flex items-center gap-2 px-2 py-1.5 text-sm">
							<input type="checkbox" disabled={disabled} checked={selectedIds.includes(g.id)} onChange={() => toggle(g.id)} />
							<span className="flex-1">{g.name}</span>
							{g.description && <span className="text-xs text-muted">{g.description}</span>}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
