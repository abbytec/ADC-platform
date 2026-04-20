import { useEffect, useRef, useCallback } from "react";
import { useTranslation } from "@ui-library/utils/i18n-react";
import { router } from "@common/utils/router";
import type { Permission } from "@common/types/identity/Permission.ts";
import type { Project } from "@common/types/project-manager/Project.ts";
import { getVisibleProjectTabs } from "../utils/permissions.ts";
import { BacklogView } from "./BacklogView.tsx";
import { SprintsView } from "./SprintsView.tsx";
import { MilestonesView } from "./MilestonesView.tsx";

interface Props {
	project: Project;
	orgSlug: string;
	scopes: Permission[];
	activeTab: string;
	onBack: () => void;
}

export function ProjectDetailView({ project, orgSlug, scopes, activeTab, onBack }: Props) {
	const { t } = useTranslation({ namespace: "adc-project-manager" });
	const visibleTabs = getVisibleProjectTabs(scopes);
	const tabItems = visibleTabs.map((tab) => ({ id: tab.id, label: t(`tabs.${tab.label}`) }));

	const tabsRef = useRef<HTMLElement>(null);
	const breadcrumbRef = useRef<HTMLElement>(null);
	const handleTabChange = useCallback(
		(tabId: string) => {
			router.navigate(`/${orgSlug}/${project.slug}/${tabId}`);
		},
		[orgSlug, project.slug]
	);

	useEffect(() => {
		const el = tabsRef.current;
		if (!el) return;
		const handler = (e: Event) => handleTabChange((e as CustomEvent<string>).detail);
		el.addEventListener("adcTabChange", handler);
		return () => el.removeEventListener("adcTabChange", handler);
	});

	useEffect(() => {
		const el = breadcrumbRef.current;
		if (!el) return;
		const handler = () => onBack();
		el.addEventListener("adcBack", handler);
		return () => el.removeEventListener("adcBack", handler);
	}, [onBack]);

	const renderTab = () => {
		switch (activeTab) {
			case "issues":
				return <BacklogView project={project} scopes={scopes} />;
			case "sprints":
				return <SprintsView project={project} scopes={scopes} />;
			case "milestones":
				return <MilestonesView project={project} scopes={scopes} />;
			default:
				return <BacklogView project={project} scopes={scopes} />;
		}
	};

	const breadcrumbItems = JSON.stringify([{ label: t("common.title"), href: "/" }, { label: project.name }]);

	return (
		<div className="space-y-4">
			<adc-top-breadcrumb ref={breadcrumbRef} items={breadcrumbItems} back-label={t("common.back")} />
			{visibleTabs.length > 1 && <adc-tabs ref={tabsRef} tabs={JSON.stringify(tabItems)} activeTab={activeTab} variant="underline" />}
			<div className="mt-4">{renderTab()}</div>
		</div>
	);
}
