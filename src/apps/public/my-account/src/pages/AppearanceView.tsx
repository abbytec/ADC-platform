import { useTheme } from "../hooks/useTheme";

export default function AppearanceView() {
	const { mode, changeTheme } = useTheme();

	const THEMES = [
		{
			key: "light",
			label: "Claro",
			description: "Limpio y brillante",
			icon: (
				<svg
					className="w-6 h-6 text-text"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<circle cx="12" cy="12" r="4" strokeWidth="2" />
					<path
						strokeWidth="2"
						strokeLinecap="round"
						d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
					/>
				</svg>
			),
		},
		{
			key: "dark",
			label: "Oscuro",
			description: "Suave para la vista",
			icon: (
				<svg
					className="w-6 h-6 text-text"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
					/>
				</svg>
			),
		},
	] as const;

	return (
		<div className="w-full flex flex-col pl-20 lg:pl-70">
			{/* Title */}
			<div className="mb-4">
				<h1 className="text-2xl font-bold text-text">
					Apariencia
				</h1>
				<p className="text-muted">
					Personaliza cómo se ve el panel
				</p>
			</div>

			{/* Panel */}
			<div className="bg-surface p-6 md:p-8 rounded-xxl">
				<div className="mb-6">
					<h2 className="text-lg font-semibold text-text">
						Preferencia de Tema
					</h2>
					<p className="text-sm text-muted">
						Elige tu tema de color preferido
					</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
					{THEMES.map((theme) => {
						const isActive = mode === theme.key;

						return (
							<button
								key={theme.key}
								onClick={() => changeTheme(theme.key)}
								className={`
									relative bg-background rounded-xl p-6 flex flex-col items-center transition
									${
										isActive
											? "border-2 border-primary"
											: "border border-border hover:border-primary"
									}
								`}
							>
								<div className="w-12 h-12 rounded-full flex items-center justify-center mb-3 bg-surface border border-border">
									{theme.icon}
								</div>

								<span className="font-medium text-text">
									{theme.label}
								</span>

								<span className="text-sm text-muted text-center">
									{theme.description}
								</span>

								{isActive && (
									<div className="absolute top-3 right-3 w-5 h-5 bg-primary text-white text-xs flex items-center justify-center rounded-full">
										✓
									</div>
								)}
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
}