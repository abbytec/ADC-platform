import React, { memo, useCallback, useState, useEffect } from "react";

interface ShellProps {
	children: React.ReactNode;
	currentPath: string;
}

export const Shell = memo(function Shell({ children, currentPath }: ShellProps) {
	const [showConsentBanner, setShowConsentBanner] = useState(false);

	useEffect(() => {
		checkConsent();
	}, []);

	const checkConsent = () => {
		try {
			const consent = localStorage.getItem("consent");
			if (!consent) {
				setShowConsentBanner(true);
			}
		} catch {
			// Ignore localStorage errors
		}
	};

	const handleOpenPrivacyPreferences = useCallback(() => {
		setShowConsentBanner(true);
	}, []);

	const handleConsentAcceptAll = useCallback(() => {
		localStorage.setItem("consent", JSON.stringify({ analytics: true, ads: true }));
		setShowConsentBanner(false);
	}, []);

	const handleConsentDecline = useCallback(() => {
		localStorage.setItem("consent", JSON.stringify({ analytics: false, ads: false }));
		setShowConsentBanner(false);
	}, []);

	return (
		<div className="flex flex-col px-8 min-h-screen bg-primary text-text" style={{ paddingBottom: "var(--consent-h, 0px)" }}>
			<adc-site-header logo-src="/mini-logo.webp" logo-alt="ADC" home-href="/">
				<ul className="flex flex-wrap items-center gap-x-10">
					<li>
						<a href="/articles" className="hover:underline">
							Artículos
						</a>
					</li>
					<li>
						<a href="/paths" className="hover:underline">
							Paths
						</a>
					</li>
				</ul>
			</adc-site-header>

			<main className="space-y-12 grow mt-8 animate-slide-in">{children}</main>

			<adc-site-footer
				className="mt-12"
				brand-name="Abby's Digital Cafe"
				brand-slogan="Aprende, crea, comparte"
				creator-name="Abbytec"
				creator-href="https://abbytec.dev.ar/"
				onAdcOpenPrivacyPreferences={handleOpenPrivacyPreferences}
			>
				<a href="/privacy" className="underline hover:no-underline">
					Política de Privacidad
				</a>
				<span aria-hidden="true" className="mx-1">
					·
				</span>
				<a href="/terms" className="underline hover:no-underline">
					Términos y Condiciones
				</a>
				<span aria-hidden="true" className="mx-1">
					·
				</span>
				<a href="/cookies" className="underline hover:no-underline">
					Política de Cookies
				</a>
			</adc-site-footer>

			<adc-consent-banner
				visible={showConsentBanner}
				restricted-region={false}
				privacy-href="/privacy"
				cookies-href="/cookies"
				onAdcAcceptAll={handleConsentAcceptAll}
				onAdcDeclineAll={handleConsentDecline}
				onAdcAcknowledge={() => setShowConsentBanner(false)}
			></adc-consent-banner>
		</div>
	);
});
