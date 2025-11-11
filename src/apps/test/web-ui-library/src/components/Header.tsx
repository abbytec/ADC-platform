import React from "react";

export interface HeaderProps {
	title: string;
	subtitle?: string;
	actions?: React.ReactNode;
}

/**
 * Header - Encabezado de página
 * 
 * Componente para encabezados de página con título, subtítulo opcional
 * y área para acciones (botones, navegación, etc.)
 */
export function Header({ title, subtitle, actions }: HeaderProps) {
	return (
		<div
			style={{
				display: "flex",
				justifyContent: "space-between",
				alignItems: "center",
				marginBottom: "30px",
				paddingBottom: "20px",
				borderBottom: "2px solid #e5e7eb",
			}}
		>
			<div>
				<h1 style={{ margin: 0, fontSize: "2rem", color: "#111827" }}>
					{title}
				</h1>
				{subtitle && (
					<p style={{ margin: "8px 0 0 0", color: "#6b7280" }}>
						{subtitle}
					</p>
				)}
			</div>
			{actions && <div>{actions}</div>}
		</div>
	);
}

export default Header;

