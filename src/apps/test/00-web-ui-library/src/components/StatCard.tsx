import React from "react";

export interface StatCardProps {
	title: string;
	value: string | number;
	description?: string;
	color?: string;
}

/**
 * StatCard - Tarjeta para mostrar estadísticas
 * 
 * Componente reutilizable para mostrar métricas y estadísticas
 * en un formato visual consistente.
 */
export function StatCard({ title, value, description, color = "#0066cc" }: StatCardProps) {
	return (
		<div
			style={{
				background: "#f9fafb",
				padding: "20px",
				borderRadius: "8px",
				border: "1px solid #e5e7eb",
			}}
		>
			<h3
				style={{
					margin: "0 0 10px 0",
					fontSize: "32px",
					color: color,
					fontWeight: "bold",
				}}
			>
				{value}
			</h3>
			<p style={{ margin: 0, color: "#6b7280", fontWeight: "500" }}>
				{title}
			</p>
			{description && (
				<p style={{ margin: "8px 0 0 0", fontSize: "0.875rem", color: "#9ca3af" }}>
					{description}
				</p>
			)}
		</div>
	);
}

export default StatCard;

