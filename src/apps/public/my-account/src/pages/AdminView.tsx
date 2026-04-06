export default function AdminView() {
	return (
		<div className="w-full flex flex-col pl-25 lg:pl-70">
			{/* Title */}
			<div className="mb-4">
				<h2 className="text-2xl font-bold text-text">Administración</h2>
				<p className="text-muted">Opciones avanzadas de gestión de cuenta</p>
			</div>

			{/* Container */}
			<div className="bg-surface p-8 pb-6 rounded-xxl">
				{/* Header */}
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-full bg-danger/90 flex items-center justify-center shadow-sm">
						<svg
							className="w-6 h-6 text-twarn"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<path d="M12 8v4" />
							<path d="M12 16h.01" />
							<path d="M4.5 19h15c1.1 0 1.8-1.2 1.2-2.1L13.2 5.3c-.6-1-2-1-2.6 0L3.3 16.9c-.6.9.1 2.1 1.2 2.1z" />
						</svg>
					</div>

					<div>
						<h3 className="text-base font-semibold text-text">Eliminar cuenta</h3>
						<p className="text-sm text-muted">Esta acción eliminará permanentemente todos tus datos.</p>
					</div>
				</div>
				<adc-divider />

				{/* Content */}
				<div className="flex flex-col gap-5">
					{/* Warning */}
					<div className="flex items-start gap-3 text-twarn bg-warn/30 border border-warn/30 p-3 rounded-lg">
						<div className="w-6 h-6 flex items-center justify-center rounded-full bg-warn shrink-0">
							<span className="text-xs font-bold">!</span>
						</div>

						<p className="text-sm leading-relaxed">
							Asegúrate de descargar cualquier dato que quieras conservar. Una vez eliminada la cuenta, no podrás recuperarla.
						</p>
					</div>

					{/* Action */}
					<div className="flex items-center justify-end flex-wrap gap-3">
						<button className="bg-danger hover:bg-danger/90 transition-all text-tdanger font-medium px-4 py-3 rounded-lg shadow-sm">
							Eliminar cuenta
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
