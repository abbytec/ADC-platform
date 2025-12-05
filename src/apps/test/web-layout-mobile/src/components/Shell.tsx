import React, { memo } from "react";
import "@ui-library/loader";
import { BottomNav } from "./BottomNav.tsx";

interface ShellProps {
	children: React.ReactNode;
	currentPath: string;
}

export const Shell = memo(function Shell({ children, currentPath }: ShellProps) {
	return (
		<div
			style={{
				minHeight: "100vh",
				background: "linear-gradient(180deg, #1a202c 0%, #0d1117 100%)",
				paddingBottom: "80px", // Espacio para la navegación inferior
			}}
		>
			<adc-container maxWidth="100%" padding="16px">
				<adc-header header-title="ADC Mobile" subtitle="Panel de control" />
				<main>{children}</main>
			</adc-container>
			<BottomNav currentPath={currentPath} />
		</div>
	);
});
