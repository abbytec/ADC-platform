import { useState, useMemo } from "react";

export default function ProfileView() {
	const [form, setForm] = useState({
		name: "Ailén",
		lastName: "Franco",
		birthDate: "2002-02-04",
	});

	function handleChange(field: keyof typeof form, value: string) {
		setForm((prev) => ({ ...prev, [field]: value }));
	}

	const initials = useMemo(() => {
		return `${form.name?.[0] ?? ""}${form.lastName?.[0] ?? ""}`.toUpperCase();
	}, [form.name, form.lastName]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		console.log(form);
	};

	return (
		<div className="w-full flex flex-col pl-20 lg:pl-70">
			{/* Title */}
			<div className="mb-4">
				<h1 className="text-2xl font-bold text-text">
					Información Personal
				</h1>
				<p className="text-muted">
					Actualiza tu perfil y avatar
				</p>
			</div>

			{/* Panel */}
			<div className="bg-surface p-6 md:p-8 rounded-xxl">
				{/* Header */}
				<div className="mb-6">
					<h2 className="text-lg font-semibold text-text">
						Datos del perfil
					</h2>
					<p className="text-sm text-muted">
						Puedes modificar tu información personal
					</p>
				</div>

				<div className="max-w-3xl mx-auto">
					{/* Avatar */}
					<div className="flex flex-col items-center mb-8">
						<div className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center text-white text-xl md:text-2xl font-bold bg-gradient-to-br from-blue-400 to-purple-500">
							{initials}
						</div>

						<adc-button class="mt-4" variant="secondary">
							Subir Avatar
						</adc-button>

						<p className="text-xs text-muted mt-2 text-center">
							JPG, PNG o GIF (máx. 2MB)
						</p>
					</div>

					{/* Form */}
					<form onSubmit={handleSubmit} className="space-y-5">
						{/* Nombre / Apellido */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="block text-sm mb-1 text-text">
									Nombre
								</label>
								<adc-input
									value={form.name}
									class="w-full"
									onInput={(e) =>
										handleChange("name", (e.target as HTMLInputElement).value)
									}
								/>
							</div>

							<div>
								<label className="block text-sm mb-1 text-text">
									Apellido
								</label>
								<adc-input
									value={form.lastName}
									class="w-full"
									onInput={(e) =>
										handleChange("lastName", (e.target as HTMLInputElement).value)
									}
								/>
							</div>
						</div>

						{/* Fecha */}
						<div>
							<label className="block text-sm mb-1 text-text">
								Fecha de Nacimiento
							</label>
							<adc-input
								type="date"
								value={form.birthDate}
								class="w-full"
								onInput={(e) =>
									handleChange("birthDate", (e.target as HTMLInputElement).value)
								}
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