import React, { useState, useCallback } from "react";
import { useTranslation } from "@ui-library/utils/i18n-react";
import type { Role } from "../utils/identity-api.ts";

interface RolePickerProps {
	readonly roles: Role[];
	readonly selectedIds: string[];
	readonly onToggle: (roleId: string) => void;
}

export function RolePicker({ roles, selectedIds, onToggle }: RolePickerProps) {
	const { t } = useTranslation({ namespace: "adc-identity", autoLoad: true });
	const [search, setSearch] = useState("");

	const searchRef = useCallback((el: HTMLElement | null) => {
		if (el) el.addEventListener("adcInput", (e: Event) => setSearch((e as CustomEvent<string>).detail));
	}, []);

	const filteredRoles = roles.filter((r) => {
		if (selectedIds.includes(r.id)) return true;
		const q = search.trim().toLowerCase();
		if (q) return r.name.toLowerCase().includes(q);
		return !r.isCustom;
	});

	return (
		<>
			<adc-search-input placeholder={t("users.searchRoles")} debounce={250} ref={searchRef} />
			<div className="flex flex-wrap gap-2 mt-2 max-h-32 overflow-y-auto">
				{filteredRoles.map((role) => (
					<adc-toggle-badge
						key={role.id}
						active={selectedIds.includes(role.id)}
						ref={(el: HTMLElement | null) => el?.addEventListener("adcToggle", () => onToggle(role.id))}
					>
						{role.name}
					</adc-toggle-badge>
				))}
			</div>
		</>
	);
}
