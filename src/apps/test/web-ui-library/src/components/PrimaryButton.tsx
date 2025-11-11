import React from "react";

export interface PrimaryButtonProps {
	children: React.ReactNode;
	onClick?: () => void;
	disabled?: boolean;
	type?: "button" | "submit" | "reset";
	className?: string;
}

/**
 * PrimaryButton - Botón principal del sistema de diseño
 * 
 * Componente React reutilizable que proporciona un botón
 * con el estilo principal de la plataforma ADC.
 */
export function PrimaryButton({
	children,
	onClick,
	disabled = false,
	type = "button",
	className = "",
}: PrimaryButtonProps) {
	return (
		<button
			type={type}
			onClick={onClick}
			disabled={disabled}
			className={`primary-button ${className}`}
			style={{
				backgroundColor: disabled ? "#ccc" : "#0066cc",
				color: "white",
				padding: "0.75rem 1.5rem",
				border: "none",
				borderRadius: "0.375rem",
				fontSize: "1rem",
				fontWeight: "500",
				cursor: disabled ? "not-allowed" : "pointer",
				transition: "background-color 0.2s",
			}}
			onMouseEnter={(e) => {
				if (!disabled) {
					e.currentTarget.style.backgroundColor = "#0052a3";
				}
			}}
			onMouseLeave={(e) => {
				if (!disabled) {
					e.currentTarget.style.backgroundColor = "#0066cc";
				}
			}}
		>
			{children}
		</button>
	);
}

export default PrimaryButton;

