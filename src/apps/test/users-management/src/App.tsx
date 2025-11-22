import "@ui-library/loader";

export default function App() {
	const handleCreateUser = () => {
		console.log("Crear usuario");
	};

	return (
		<div style={{ padding: "20px" }}>
			<adc-container>
				<adc-header header-title="Gestión de Usuarios" subtitle="Administra los usuarios de la plataforma" />

				<div style={{ marginTop: "20px" }}>
					<div
						style={{
							marginBottom: "20px",
							padding: "15px",
							background: "#f0fdf4",
							border: "1px solid #bbf7d0",
							borderRadius: "6px",
							color: "#15803d",
						}}
					>
						🚀 ¡Ahora estás usando Web Components framework-agnostic!
					</div>

					<p>Lista de usuarios...</p>

					<div style={{ marginTop: "20px" }}>
						<adc-button onAdcClick={handleCreateUser}>Crear Nuevo Usuario</adc-button>
					</div>
				</div>
			</adc-container>
		</div>
	);
}
