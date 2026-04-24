import "@ui-library/utils/react-jsx";
import { useTranslation } from "@ui-library/utils/i18n-react";

/**
 * Landing mostrada cuando el visitante aún no tiene acceso al panel.
 * Describe las capacidades principales sin revelar datos sensibles.
 */
export function LandingView() {
	const { t } = useTranslation({ namespace: "adc-project-manager", autoLoad: true });

	const features = [
		{ key: "projects", icon: "📁", description: t("landing.features.projects.description") },
		{ key: "board", icon: "🗂️", description: t("landing.features.board.description") },
		{ key: "sprints", icon: "🚀", description: t("landing.features.sprints.description") },
		{ key: "calendar", icon: "📅", description: t("landing.features.calendar.description") },
	] as const;

	return (
		<div className="max-w-6xl mx-auto px-4 py-12">
			<section className="flex flex-col items-center text-center" aria-label={t("landing.heroAria")}>
				<h1 className="text-3xl sm:text-4xl font-heading font-bold text-text mb-4">{t("landing.heroTitle")}</h1>
				<p className="text-muted max-w-2xl mb-6">{t("landing.heroSubtitle")}</p>
			</section>

			<section className="grid gap-4 grid-cols-2 mt-12" aria-label={t("landing.featuresAria")}>
				{features.map(({ key, icon, description }) => (
					<adc-feature-card key={key} title={t(`landing.features.${key}.title`)}>
						<span slot="icon" aria-hidden="true" className="text-3xl">
							{icon}
						</span>
						<span>{description}</span>
					</adc-feature-card>
				))}
			</section>

			<section className="mt-12" aria-label={t("landing.howAria")}>
				<h2 className="text-2xl text-center font-heading font-bold text-text mb-4">{t("landing.howTitle")}</h2>
				<p className="text-center mt-6">{t("landing.signInHint")}</p>
			</section>
		</div>
	);
}
