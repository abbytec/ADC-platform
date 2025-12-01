import { router } from "@ui-library/utils/router";

interface NavigationProps {
	currentPath: string;
}

export function Navigation({ currentPath }: NavigationProps) {
	const handleNavigate = (path: string) => {
		if (path !== currentPath) {
			router.navigate(path);
		}
	};

	const buttonStyle = (path: string) => ({
		padding: "8px 16px",
		background: currentPath === path ? "#0052a3" : "#0066cc",
		color: "white",
		border: "none",
		borderRadius: "4px",
		cursor: "pointer",
		fontWeight: currentPath === path ? "bold" : "normal",
		transition: "background-color 0.2s",
	});

	return (
		<nav
			style={{
				display: "flex",
				gap: "10px",
				padding: "15px 0",
				borderBottom: "2px solid #e0e0e0",
				marginBottom: "20px",
			}}
		>
			<button onClick={() => handleNavigate("/")} style={buttonStyle("/")}>
				Inicio
			</button>
			<button onClick={() => handleNavigate("/users")} style={buttonStyle("/users")}>
				Usuarios
			</button>
			<button onClick={() => handleNavigate("/config")} style={buttonStyle("/config")}>
				Configuración
			</button>
		</nav>
	);
}
