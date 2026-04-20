import { useState, useMemo, useEffect } from "react";
import { accountApi } from "../utils/account-api";
import { toast } from "../utils/toast";

export default function ProfileView() {
	const [form, setForm] = useState({
		name: "",
		lastName: "",
		birthDate: "",
	});

	const [original, setOriginal] = useState({
		name: "",
		lastName: "",
		birthDate: "",
	});

	const [loading, setLoading] = useState(true);

	const hasChanges = useMemo(() => {
		return (
			form.name !== original.name ||
			form.lastName !== original.lastName ||
			form.birthDate !== original.birthDate
		);
	}, [form, original]);

	useEffect(() => {
		async function fetchProfile() {
			try {
				const res = await accountApi.getCurrentUser();

				if (res.success && res.data) {
					const user = res.data;

					const userData = {
						name: user?.metadata?.name ?? "",
						lastName: user?.metadata?.lastName ?? "",
						birthDate: user?.metadata?.birthDate ?? "",
					};

					setForm(userData);
					setOriginal(userData);
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

		if (!hasChanges) {
			toast.info("No hay cambios para guardar");
			return;
		}

		try {
			await accountApi.patchCurrentUser({
				name: form.name,
				lastName: form.lastName,
				birthDate: form.birthDate,
			});

			setOriginal(form);
			toast.success("Perfil actualizado correctamente!");
		} catch (err) {
			globalThis.dispatchEvent(
				new CustomEvent("adc-error", {
					detail: {
						errorKey: "update_profile_error",
						message: "Ocurrió un error al actualizar el perfil",
					},
				})
			);
		}
	};

	function handleChange(field: keyof typeof form, value: string) {
		setForm((prev) => ({ ...prev, [field]: value }));
	}

	const initials = useMemo(() => {
		return `${form.name?.[0] ?? ""}${form.lastName?.[0] ?? ""}`.toUpperCase();
	}, [form.name, form.lastName]);

	if (loading) {
		return <p className="p-4">Cargando perfil...</p>;
	}

	return (
		<div className="w-full flex flex-col pl-25 lg:pl-70">
			<div className="mb-4">
				<h2 className="font-bold text-text">Información Personal</h2>
				<p className="text-muted">Actualiza tu perfil y avatar</p>
			</div>

			<div className="bg-surface p-8 pb-6 rounded-xxl">
				<div className="mb-6">
					<h3 className="text-lg font-semibold text-text">Datos del perfil</h3>
					<p className="text-sm text-muted">Puedes modificar tu información personal</p>
				</div>

				<div className="max-w-3xl mx-auto">
					<div className="flex flex-col items-center mb-8">
						<div className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center text-white text-xl md:text-2xl font-bold bg-linear-to-br from-blue-400 to-purple-500">
							{initials}
						</div>

						<adc-button className="mt-4" variant="primary">
							Subir Avatar
						</adc-button>

						<p className="text-xs text-muted mt-2 text-center">
							JPG, PNG o GIF (máx. 2MB)
						</p>
					</div>

					<form onSubmit={handleSubmit} className="space-y-5">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label htmlFor="profile-name" className="block text-sm mb-1 text-text">
									Nombre
								</label>
								<adc-input
									inputId="profile-name"
									value={form.name}
									className="w-full"
									onInput={(e) =>
										handleChange("name", (e.target as HTMLInputElement).value)
									}
								/>
							</div>

							<div>
								<label htmlFor="profile-lastName" className="block text-sm mb-1 text-text">
									Apellido
								</label>
								<adc-input
									inputId="profile-lastName"
									value={form.lastName}
									className="w-full"
									onInput={(e) =>
										handleChange("lastName", (e.target as HTMLInputElement).value)
									}
								/>
							</div>
						</div>

						<div>
							<label htmlFor="profile-birthDate" className="block text-sm mb-1 text-text">
								Fecha de Nacimiento
							</label>
							<adc-input
								inputId="profile-birthDate"
								type="date"
								value={form.birthDate}
								className="w-full"
								onInput={(e) =>
									handleChange("birthDate", (e.target as HTMLInputElement).value)
								}
							/>
						</div>

						<div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-4">
						<adc-button
	type="submit"
	variant="primary"
	disabled={!hasChanges}
	style={{ opacity: !hasChanges ? 0.5 : 1 }}
>
	Guardar cambios
</adc-button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
}