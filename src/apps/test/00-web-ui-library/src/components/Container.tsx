import React from "react";

export interface ContainerProps {
	children: React.ReactNode;
	maxWidth?: string;
	padding?: string;
}

/**
 * Container - Contenedor principal
 * 
 * Componente para envolver contenido con márgenes y padding consistentes
 */
export function Container({ 
	children, 
	maxWidth = "1200px", 
	padding = "20px" 
}: ContainerProps) {
	return (
		<div style={{ padding }}>
			<div
				style={{
					maxWidth,
					margin: "0 auto",
					background: "white",
					padding: "30px",
					borderRadius: "8px",
					boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
				}}
			>
				{children}
			</div>
		</div>
	);
}

export default Container;

