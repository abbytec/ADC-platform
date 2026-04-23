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
						<div className="absolute z-20 left-0 right-0 mt-1 bg-background border border-surface rounded-xl shadow-lg max-h-48 overflow-y-auto">
							{searching ? (
								<div className="flex justify-center py-3">
									<adc-spinner />
								</div>
							) : (
								results
									.filter((u) => !selectedIds.includes(u.id))
									.map((u) => (
										<button
											key={u.id}
											type="button"
											className="w-full text-left px-3 py-2 hover:bg-surface/50 transition-colors cursor-pointer flex items-center justify-between"
											onClick={() => add(u)}
										>
											<adc-user-summary username={u.username} email={u.email} />
											<adc-icon-plus size="1rem" />
										</button>
									))
							)}
						</div>
					)}
				</div>
			)}
			<div>
				{selectedIds.length === 0 && <span className="text-xs text-muted">{t("settings.noMembers")}</span>}
				{selectedIds.length > 0 && (
					<ul className="divide-y divide-surface">
						{selectedIds.map((id) => {
							const u = cache[id];
							return (
								<li key={id} className="flex items-center justify-between py-2">
									<adc-user-summary username={u?.username || id} email={u?.email} />
									{!disabled && (
										<adc-button-rounded
											variant="danger"
											aria-label={t("common.delete")}
											onClick={() => remove(id)}
											size="md"
										>
											<adc-icon-close size="0.875rem" />
										</adc-button-rounded>
									)}
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</div>
	);
}
