import { useState, useMemo, useEffect } from "react";
import { accountApi } from "../utils/account-api";

export default function ProfileView() {
	const [form, setForm] = useState({
		name: "",
		lastName: "",
		birthDate: "",
	});
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		async function fetchProfile() {
			try {
				const res = await accountApi.getCurrentUser();
				if (res.success) {
					const user = res.data;
					setForm({
						name: user.metadata?.name || "",
						lastName: user.metadata?.lastName || "",
						birthDate: user.metadata?.birthDate || "",
					});
				}
			} catch (err) {
				console.error("Error al obtener usuario:", err);
			} finally {
				setLoading(false);
			}
		}
		fetchProfile();
	}, []);

	const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  try {
    await accountApi.updateCurrentUser({
      name: form.name,
      lastName: form.lastName,
      birthDate: form.birthDate,
    });

    alert("Perfil actualizado correctamente");
  } catch (err: any) {
    console.error("Error actualizando perfil", err?.response ?? err);
    alert("Ocurrió un error al actualizar el perfil");
  }
};

	function handleChange(field: keyof typeof form, value: string) {
		setForm((prev) => ({ ...prev, [field]: value }));
	}

	const initials = useMemo(() => {
		return `${form.name?.[0] ?? ""}${form.lastName?.[0] ?? ""}`.toUpperCase();
	}, [form.name, form.lastName]);

	return (
		<div className="w-full flex flex-col pl-25 lg:pl-70">
			{/* Title */}
			<div className="mb-4">
				<h2 className="font-bold text-text">Información Personal</h2>
				<p className="text-muted">Actualiza tu perfil y avatar</p>
			</div>

			{/* Panel */}
			<div className="bg-surface p-8 pb-6 rounded-xxl">
				{/* Header */}
				<div className="mb-6">
					<h3 className="!mt-0 text-lg font-semibold text-text">Datos del perfil</h3>
					<p className="text-sm text-muted">Puedes modificar tu información personal</p>
				</div>

				<div className="max-w-3xl mx-auto">
					{/* Avatar */}
					<div className="flex flex-col items-center mb-8">
						<div className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center text-white text-xl md:text-2xl font-bold bg-gradient-to-br from-blue-400 to-purple-500">
							{initials}
						</div>

						<adc-button class="mt-4" variant="primary">
							Subir Avatar
						</adc-button>

						<p className="text-xs text-muted mt-2 text-center">JPG, PNG o GIF (máx. 2MB)</p>
					</div>

					{/* Form */}
					<form onSubmit={handleSubmit} className="space-y-5">
						{/* Nombre / Apellido */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="block text-sm mb-1 text-text">Nombre</label>
								<adc-input
									value={form.name}
									class="w-full"
									onInput={(e) => handleChange("name", (e.target as HTMLInputElement).value)}
								/>
							</div>

							<div>
								<label className="block text-sm mb-1 text-text">Apellido</label>
								<adc-input
									value={form.lastName}
									class="w-full"
									onInput={(e) => handleChange("lastName", (e.target as HTMLInputElement).value)}
								/>
							</div>
						</div>

						{/* Fecha */}
						<div>
							<label className="block text-sm mb-1 text-text">Fecha de Nacimiento</label>
							<adc-input
								type="date"
								value={form.birthDate}
								class="w-full"
								onInput={(e) => handleChange("birthDate", (e.target as HTMLInputElement).value)}
							/>
						</div>

						{/* Submit */}
						<div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-4">
							<adc-button type="submit" variant="primary">
								Guardar Cambios
							</adc-button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
}
