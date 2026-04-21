import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@ui-library/utils/i18n-react";
import { identityPmApi } from "../../utils/identity-api.ts";
import { ClientUser } from "@common/types/identity/User.ts";

interface Props {
	selectedIds: string[];
	onChange: (ids: string[]) => void;
	disabled?: boolean;
	label?: string;
}

/**
 * Picker multi de usuarios contra Identity. Usa `adc-search-input` con debounce
 * para consultar `/api/identity/users/search` y mantiene un cache local de los
 * chips ya seleccionados para poder mostrar el nombre sin re-fetchear.
 */
export function UserPicker({ selectedIds, onChange, disabled, label }: Props) {
	const { t } = useTranslation({ namespace: "adc-project-manager" });
	const [results, setResults] = useState<ClientUser[]>([]);
	const [searching, setSearching] = useState(false);
	const [cache, setCache] = useState<Record<string, ClientUser>>({});
	const searchRef = useRef<HTMLElement | null>(null);

	// Pre-hidrata nombres para IDs seleccionados que aún no estén en cache.
	useEffect(() => {
		const missing = selectedIds.filter((id) => !cache[id]);
		if (missing.length === 0) return;
		(async () => {
			const fetched: Record<string, ClientUser> = { ...cache };
			await Promise.all(
				missing.map(async (id) => {
					const r = await identityPmApi.getUser(id);
					if (r.success && r.data) fetched[id] = r.data;
				})
			);
			setCache(fetched);
		})();
	}, [selectedIds, cache]);

	const handleSearch = useCallback(async (query: string) => {
		if (!query || query.length < 2) {
			setResults([]);
			return;
		}
		setSearching(true);
		const res = await identityPmApi.searchUsers(query);
		if (res.success && res.data) setResults(res.data);
		setSearching(false);
	}, []);

	const attachRef = useCallback(
		(el: HTMLElement | null) => {
			searchRef.current = el;
			if (el) el.addEventListener("adcInput", (e: Event) => handleSearch((e as CustomEvent<string>).detail));
		},
		[handleSearch]
	);

	const add = (user: ClientUser) => {
		if (selectedIds.includes(user.id)) return;
		setCache((prev) => ({ ...prev, [user.id]: user }));
		onChange([...selectedIds, user.id]);
		setResults([]);
	};
	const remove = (id: string) => onChange(selectedIds.filter((x) => x !== id));

	return (
		<div className="space-y-2">
			{label && <label className="block text-sm font-medium text-text">{label}</label>}
			{!disabled && (
				<div className="relative">
					<adc-search-input ref={attachRef} placeholder={t("settings.searchUsers")} debounce={350} />
					{(results.length > 0 || searching) && (
						<div className="absolute z-20 left-0 right-0 mt-1 bg-background border border-border rounded-md shadow max-h-48 overflow-y-auto">
							{searching ? (
								<div className="text-center py-2 text-xs text-muted">{t("common.loading")}</div>
							) : (
								results
									.filter((u) => !selectedIds.includes(u.id))
									.map((u) => (
										<button
											key={u.id}
											type="button"
											className="w-full text-left px-3 py-2 hover:bg-surface text-sm"
											onClick={() => add(u)}
										>
											<span className="font-medium">{u.username}</span>
											{u.email && <span className="text-xs text-muted ml-2">{u.email}</span>}
										</button>
									))
							)}
						</div>
					)}
				</div>
			)}
			<div className="flex flex-wrap gap-1">
				{selectedIds.length === 0 && <span className="text-xs text-muted">{t("settings.noMembers")}</span>}
				{selectedIds.map((id) => {
					const u = cache[id];
					return (
						<span
							key={id}
							className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface border border-border text-xs"
						>
							{u?.username || id}
							{!disabled && (
								<button
									type="button"
									onClick={() => remove(id)}
									className="text-muted font-bold hover:text-tdanger"
									aria-label={t("common.delete")}
								>
									×
								</button>
							)}
						</span>
					);
				})}
			</div>
		</div>
	);
}
