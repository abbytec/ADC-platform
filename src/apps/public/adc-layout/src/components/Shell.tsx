import React, { memo } from "react";
import { getUrl, getBaseUrl } from "@common/utils/url-utils.js";

interface ShellProps {
	children: React.ReactNode;
	headerSlot?: React.ReactNode;
}

const AUTH_URL = getUrl(3012, "auth.adigitalcafe.com");
const API_BASE_URL = getBaseUrl(3000);

export const Shell = memo(function Shell({ children, headerSlot }: ShellProps) {
	return (
		<div className="flex flex-col px-8 min-h-screen text-text" style={{ paddingBottom: "var(--consent-h, 0px)" }}>
			<adc-site-header logo-src="/ui/images/mini-logo.webp" logo-alt="ADC" home-href="/" auth-url={AUTH_URL} api-base-url={API_BASE_URL}>
				{headerSlot}
			</adc-site-header>

			<main className="space-y-12 grow mt-8 animate-slide-in">{children}</main>

			<adc-site-footer
				className="mt-12"
				brand-name="Abby's Digital Cafe"
				brand-slogan="Una taza de código con tintes de amistad"
				creator-name="Abbytec"
				creator-href="https://abbytec.dev.ar/"
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
		</div>
	);
});
