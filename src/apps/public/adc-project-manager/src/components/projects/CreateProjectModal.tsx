import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@ui-library/utils/i18n-react";
import type { ProjectVisibility } from "@common/types/project-manager/Project.ts";
import { pmApi } from "../../utils/pm-api.ts";

const VISIBILITIES: ProjectVisibility[] = ["private", "org", "public"];
const SLUG_DEBOUNCE_MS = 400;

type SlugStatus = "idle" | "checking" | "available" | "taken" | "invalid";

interface ProjectFormState {
	name: string;
	slug: string;
	description: string;
	visibility: ProjectVisibility;
}

interface Props {
	orgSlug: string;
	onClose: () => void;
	onSubmit: (form: ProjectFormState) => Promise<void> | void;
}

export function CreateProjectModal({ orgSlug, onClose, onSubmit }: Props) {
	const { t } = useTranslation({ namespace: "adc-project-manager" });
	const [form, setForm] = useState<ProjectFormState>({ name: "", slug: "", description: "", visibility: "org" });
	const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");
	const slugCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const modalRef = useCallback(
		(el: HTMLElement | null) => {
			if (el) el.addEventListener("adcClose", onClose);
		},
		[onClose]
	);

	const handleSlugInput = useCallback(
		(value: string) => {
			const normalized = value.toLowerCase().trim();
			setForm((f) => ({ ...f, slug: normalized }));
			if (slugCheckTimer.current) clearTimeout(slugCheckTimer.current);
			if (!normalized) {
				setSlugStatus("idle");
				return;
			}
			if (!/^[a-z0-9-]+$/.test(normalized)) {
				setSlugStatus("invalid");
				return;
			}
			setSlugStatus("checking");
			slugCheckTimer.current = setTimeout(async () => {
				const res = await pmApi.checkProjectSlug(orgSlug, normalized);
				if (res.success && res.data) setSlugStatus(res.data.available ? "available" : "taken");
				else setSlugStatus("idle");
			}, SLUG_DEBOUNCE_MS);
		},
		[orgSlug]
	);

	useEffect(() => {
		return () => {
			if (slugCheckTimer.current) clearTimeout(slugCheckTimer.current);
		};
	}, []);

	const handleSave = async () => {
		if (!form.name || slugStatus !== "available") return;
		await onSubmit(form);
	};

	return (
		<adc-modal ref={modalRef} open modalTitle={t("projects.newProject")} size="md">
			<div className="space-y-3 p-4 min-w-80">
				<div>
					<label className="block text-sm font-medium mb-1 text-text">{t("projects.slug")}</label>
					<div className="flex items-center gap-2">
						<adc-input value={form.slug} onInput={(e: any) => handleSlugInput(e.target.value)} class="flex-1" />
						<span aria-live="polite" className="min-w-6">
							{slugStatus === "checking" && <span className="text-muted animate-pulse">…</span>}
							{slugStatus === "available" && (
								<span className="text-tok" title={t("projects.slugAvailable")}>
									✓
								</span>
							)}
							{(slugStatus === "taken" || slugStatus === "invalid") && (
								<span className="text-tdanger" title={t(`projects.slug${slugStatus === "taken" ? "Taken" : "Invalid"}`)}>
									✗
								</span>
							)}
						</span>
					</div>
					{slugStatus === "taken" && <p className="text-xs text-tdanger mt-1">{t("projects.slugTaken")}</p>}
					{slugStatus === "invalid" && <p className="text-xs text-tdanger mt-1">{t("projects.slugInvalid")}</p>}
				</div>
				<div>
					<label className="block text-sm font-medium mb-1 text-text">{t("common.name")}</label>
					<adc-input value={form.name} onInput={(e: any) => setForm({ ...form, name: e.target.value })} />
				</div>
				<div>
					<label className="block text-sm font-medium mb-1 text-text">{t("common.description")}</label>
					<adc-input value={form.description} onInput={(e: any) => setForm({ ...form, description: e.target.value })} />
				</div>
				<div>
					<label className="block text-sm font-medium mb-1 text-text">{t("projects.visibility")}</label>
					<adc-combobox
						value={form.visibility}
						options={JSON.stringify(VISIBILITIES.map((v) => ({ label: v, value: v })))}
						onadcChange={(e: any) => setForm({ ...form, visibility: e.detail as ProjectVisibility })}
					/>
				</div>
				<div className="flex gap-2 justify-end pt-2">
					<adc-button variant="accent" onClick={onClose}>
						{t("common.cancel")}
					</adc-button>
					<adc-button variant="primary" onClick={handleSave} disabled={slugStatus !== "available" || !form.name}>
						{t("common.save")}
					</adc-button>
				</div>
			</div>
		</adc-modal>
	);
}

export type { ProjectFormState };
