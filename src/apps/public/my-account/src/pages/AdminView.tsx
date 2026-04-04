export default function AdminView() {
	return (
		<div className="w-full flex flex-col pl-20 lg:pl-70">
			{/* Title */}
			<div className="mb-4">
				<h1 className="text-2xl font-bold text-text">
					Administración
				</h1>
				<p className="text-muted">
					Opciones avanzadas de gestión de cuenta
				</p>
			</div>

			{/* Container */}
			<div className="bg-surface p-8 pb-6 rounded-xxl border border-danger/40">

				{/* Danger Zone Header */}
				<div className="flex items-start gap-3 mb-6">
					<div className="w-10 h-10 rounded-full bg-danger flex items-center justify-center">
						<svg
							className="w-5 h-5 text-twarn"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="2"
								d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 
								1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 
								0L3.34 16c-.77 1.33.19 3 1.73 3z"
							/>
						</svg>
					</div>
				</div>

				{/* Delete Account Card */}
				<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border border-danger/40 rounded-xl p-6 mb-6 bg-background">

					<div>
						<h3 className="text-base font-semibold text-text mb-1">
							Eliminar Cuenta
						</h3>
						<p className="text-sm text-muted max-w-lg">
							Elimina permanentemente tu cuenta y todos los datos asociados.
							Esta acción no se puede deshacer.
						</p>
					</div>

					<button className="bg-danger hover:opacity-90 transition text-tdanger text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 w-fit">
						Eliminar Cuenta
					</button>
				</div>

				{/* Warning Box */}
				<div className="flex items-start gap-3 bg-warn border border-warn/60 rounded-xl p-4">
					<div className="w-8 h-8 flex items-center justify-center rounded-full bg-warn">
						<span className="text-twarn font-bold">!</span>
					</div>

					<div>
						<p className="text-sm font-medium text-twarn">
							Antes de eliminar tu cuenta
						</p>
						<p className="text-sm text-twarn/80">
							Asegúrate de descargar cualquier dato que quieras conservar.
							Una vez eliminada, no podemos recuperar tu cuenta.
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}