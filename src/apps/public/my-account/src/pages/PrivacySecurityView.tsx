import React, { useState } from "react";
import { accountApi } from "../utils/account-api";
import { toast } from "../utils/toast";
export default function PrivacySecurityView() {
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");

	const [showCurrent, setShowCurrent] = useState(false);
	const [showNew, setShowNew] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
	e.preventDefault();

	// Validaciones
	if (!currentPassword || !newPassword || !confirmPassword) {
		toast.error("Todos los campos son obligatorios");
		return;
	}

	if (newPassword.length < 8) {
		toast.warning("La nueva contraseña debe tener al menos 8 caracteres");
		return;
	}

	if (newPassword !== confirmPassword) {
		toast.error("Las contraseñas no coinciden");
		return;
	}

	try {
		await accountApi.changePassword(currentPassword, newPassword);

		toast.success("Contraseña actualizada correctamente");

		setCurrentPassword("");
		setNewPassword("");
		setConfirmPassword("");
	} catch (error: any) {
		console.error(error);

		toast.error(
			error?.message || "Error al cambiar la contraseña"
		);
	}
};
	   return (
		   <>
			  
			   <div className="w-full flex flex-col pl-25 lg:pl-70">
			{/* Title */}
			<div className="mb-4">
				<h2 className="text-2xl font-bold text-text">Privacidad y Seguridad</h2>
				<p className="text-muted">Gestiona tu contraseña y configuración de seguridad</p>
			</div>

			{/* Panel */}
			<div className="bg-surface p-8 pb-6 rounded-xxl">
				{/* Header */}
				<div className="mb-6">
					<h3 className="!mt-0 text-lg font-semibold text-text">Cambiar Contraseña</h3>
					<p className="text-sm text-muted">Asegúrate de que tu cuenta use una contraseña segura</p>
				</div>

				{/* Contenido centrado */}
				<div className="max-w-2xl mx-auto">
					<form onSubmit={handleSubmit} className="space-y-5">
						{/* Contraseña actual */}
						<div>
							<label className="block text-sm mb-1 text-text">Contraseña Actual</label>

							<div className="relative">
								<adc-input
									type={showCurrent ? "text" : "password"}
									placeholder="Ingresa tu contraseña actual"
									value={currentPassword}
									class="w-full pr-12"
									onInput={(e) => setCurrentPassword((e.target as HTMLInputElement).value)}
								/>

								<button
									type="button"
									onClick={() => setShowCurrent(!showCurrent)}
									className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted"
								>
									{showCurrent ? "Ocultar" : "Ver"}
								</button>
							</div>
						</div>

						{/* Nueva contraseña */}
						<div>
							<label className="block text-sm mb-1 text-text">Nueva Contraseña</label>

							<div className="relative">
								<adc-input
									type={showNew ? "text" : "password"}
									placeholder="Ingresa tu nueva contraseña"
									value={newPassword}
									class="w-full pr-12"
									onInput={(e) => setNewPassword((e.target as HTMLInputElement).value)}
								/>

								<button
									type="button"
									onClick={() => setShowNew(!showNew)}
									className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted"
								>
									{showNew ? "Ocultar" : "Ver"}
								</button>
							</div>
						</div>

						{/* Confirmar contraseña */}
						<div>
							<label className="block text-sm mb-1 text-text">Confirmar Nueva Contraseña</label>

							<div className="relative">
								<adc-input
									type={showConfirm ? "text" : "password"}
									placeholder="Confirma tu nueva contraseña"
									value={confirmPassword}
									class="w-full pr-12"
									onInput={(e) => setConfirmPassword((e.target as HTMLInputElement).value)}
								/>

								<button
									type="button"
									onClick={() => setShowConfirm(!showConfirm)}
									className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted"
								>
									{showConfirm ? "Ocultar" : "Ver"}
								</button>
							</div>
						</div>

						{/* Submit */}
						<div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-4">
							<adc-button type="submit" variant="primary">
								Actualizar Contraseña
							</adc-button>
						</div>
					</form>
				</div>
			</div>
		</div>
		</>
	);
}
