import "@ui-library/utils/react-jsx";
import { useState } from "react";
import { mockApps } from "../../data/mockData";
import type { App } from "../../types";

interface AppsTabProps {
	slug: string;
}

export default function AppsTab({ slug }: AppsTabProps) {
	const [apps, setApps] = useState<App[]>(mockApps);

	const handleToggleApp = (appId: string) => {
		setApps((prev) =>
			prev.map((app) =>
				app.id === appId ? { ...app, enabled: !app.enabled } : app
			)
		);
	};

	const enabledCount = apps.filter((app) => app.enabled).length;
	const totalCount = apps.length;

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h2 className="text-2xl font-bold text-text mb-1">Aplicaciones</h2>
				<p className="text-muted">Gestiona las aplicaciones habilitadas en tu organización</p>
			</div>

			{/* Stats Section */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div className="bg-surface rounded-xl p-6 border border-border">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm text-muted mb-1">Aplicaciones Activas</p>
							<p className="text-3xl font-bold text-text">{enabledCount}</p>
						</div>
						<div className="text-4xl">✅</div>
					</div>
				</div>

				<div className="bg-surface rounded-xl p-6 border border-border">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm text-muted mb-1">Total de Aplicaciones</p>
							<p className="text-3xl font-bold text-text">{totalCount}</p>
						</div>
						<div className="text-4xl">📱</div>
					</div>
				</div>
			</div>

			{/* Apps List */}
			<div className="bg-surface rounded-xxl p-8 border border-border">
				<div className="space-y-3">
					{apps.map((app) => (
						<div
							key={app.id}
							className={`flex items-center justify-between p-5 rounded-xl border-2 transition-all ${
								app.enabled
									? "bg-success/10 border-success/30"
									: "bg-background border-border hover:border-muted"
							}`}
						>
							<div className="flex items-center gap-4 flex-1 min-w-0">
								{/* Icon */}
								<div className="text-3xl flex-shrink-0">{app.icon}</div>

								{/* Info */}
								<div className="flex-1 min-w-0">
									<h3 className="font-semibold text-text">{app.name}</h3>
									{app.description && (
										<p className="text-sm text-muted truncate">{app.description}</p>
									)}
								</div>
							</div>

							{/* Toggle */}
							<div className="flex-shrink-0 ml-4">
								<button
									onClick={() => handleToggleApp(app.id)}
									className={`relative w-14 h-8 rounded-full transition-colors ${
										app.enabled ? "bg-success" : "bg-muted"
									}`}
									role="switch"
									aria-checked={app.enabled}
									aria-label={`${app.enabled ? "Desactivar" : "Activar"} ${app.name}`}
								>
									<div
										className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${
											app.enabled ? "translate-x-6" : "translate-x-0"
										}`}
									/>
									<span className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
										{app.enabled ? "✓" : ""}
									</span>
								</button>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Info Box */}
			<div className="bg-info/10 border border-info/30 rounded-xl p-6">
				<div className="flex gap-4">
					<div className="text-2xl">ℹ️</div>
					<div className="flex-1">
						<h4 className="font-semibold text-text mb-2">Cambios de Aplicaciones</h4>
						<p className="text-sm text-text">
							Los cambios en las aplicaciones habilitadas se aplicarán inmediatamente a toda tu organización. 
							Los miembros del equipo verán las aplicaciones nuevas en su próxima sesión.
						</p>
					</div>
				</div>
			</div>

			{/* Action Buttons */}
			<div className="flex gap-3">
				<adc-button type="button" appearance="secondary">
					Descartar Cambios
				</adc-button>
				<adc-button type="button">
					Guardar Cambios
				</adc-button>
			</div>
		</div>
	);
}
