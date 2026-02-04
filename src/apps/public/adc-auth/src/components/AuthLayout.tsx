import React from "react";

interface AuthLayoutProps {
	children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
	return (
		<div className="min-h-screen flex flex-col bg-bg text-text">
			<adc-custom-error variant="toast" global handle-unhandled />
			<header className="flex items-center justify-center py-6 px-8 shadow-cozy bg-header text-theader rounded-b-xxl">
				<a href="https://adigitalcafe.com" aria-label="Volver al inicio" className="flex items-center gap-3">
					<img
						src="/ui/images/mini-logo.webp"
						alt="ADC"
						width="36"
						height="36"
						className="rounded-full"
						style={{ minWidth: "36px" }}
					/>
					<span className="font-heading font-bold text-xl">Abby's Digital Cafe</span>
				</a>
			</header>

			<main className="flex-1 flex items-center justify-center px-4 py-12">{children}</main>

			<adc-site-footer
				className="mt-12"
				brand-name="Abby's Digital Cafe"
				brand-slogan="Una taza de código con tintes de amistad"
				creator-name="Abbytec"
				creator-href="https://abbytec.dev.ar/"
			/>
		</div>
	);
}
