import "@ui-library/utils/react-jsx";
import { useState } from "react";
import { router } from "@common/utils/router.js";

interface SocialNetwork {
	id: string;
	platform: string;
	url: string;
}

export default function CreateOrgPage() {
	const [formData, setFormData] = useState({
		orgName: "",
		email: "",
		description: "",
		url: "",
	});

	const [socialNetworks, setSocialNetworks] = useState<SocialNetwork[]>([]);
	const [submitted, setSubmitted] = useState(false);

	const socialPlatforms = [
		{ value: "twitter", label: "Twitter / X", icon: "𝕏" },
		{ value: "linkedin", label: "LinkedIn", icon: "💼" },
		{ value: "instagram", label: "Instagram", icon: "📸" },
		{ value: "facebook", label: "Facebook", icon: "👍" },
		{ value: "github", label: "GitHub", icon: "🐙" },
		{ value: "discord", label: "Discord", icon: "💬" },
		{ value: "youtube", label: "YouTube", icon: "📺" },
		{ value: "tiktok", label: "TikTok", icon: "🎵" },
	];

	const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		const { name, value } = e.target;
		setFormData((prev) => ({
			...prev,
			[name]: value,
		}));
	};

	const handleAddSocialNetwork = () => {
		setSocialNetworks((prev) => [
			...prev,
			{
				id: `social-${Date.now()}`,
				platform: "twitter",
				url: "",
			},
		]);
	};

	const handleRemoveSocialNetwork = (id: string) => {
		setSocialNetworks((prev) => prev.filter((s) => s.id !== id));
	};

	const handleSocialNetworkChange = (id: string, field: "platform" | "url", value: string) => {
		setSocialNetworks((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		if (!formData.orgName.trim()) {
			alert("Por favor ingresa el nombre de la organización");
			return;
		}

		if (!formData.email.trim()) {
			alert("Por favor ingresa tu email");
			return;
		}

		// Validar formato de email básico
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(formData.email)) {
			alert("Por favor ingresa un email válido");
			return;
		}

		// Submit request (in a real app, this would send to backend)
		setSubmitted(true);

		// In a real scenario, redirect after a delay to confirmation page
		setTimeout(() => {
			router.navigate("/org-management");
		}, 3500);
	};

	return (
		<div className="min-h-screen bg-background px-4 py-12">
			<div className="max-w-2xl mx-auto">
				{/* Header */}
				<div className="text-center mb-12">
					<h1 className="text-4xl font-bold text-text mb-3">Crear Nueva Organización</h1>
					<p className="text-lg text-muted">Configura tu organización y comienza a colaborar con tu equipo en ADC Platform</p>
				</div>

				{/* Form Container */}
				<div className="bg-surface rounded-xxl p-8 shadow-sm border border-border">
					{submitted ? (
						// Success message
						<div className="flex flex-col items-center justify-center py-12">
							<div className="w-16 h-16 rounded-full bg-warning/20 flex items-center justify-center mb-4">
								<svg className="w-8 h-8 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
							</div>
							<h2 className="text-2xl font-bold text-text mb-2">¡Solicitud enviada!</h2>
							<p className="text-center text-muted mb-4 max-w-md">
								Tu solicitud de organización ha sido recibida y está pendiente de revisión por parte del equipo administrativo.
							</p>
							<div className="bg-warning/10 border border-warning/20 rounded-lg p-4 mb-6 w-full">
								<div className="text-sm text-text">
									<p className="font-semibold mb-2">¿Qué sucede ahora?</p>
									<ul className="space-y-2 text-xs">
										<li className="flex gap-2">
											<span className="text-warning">✓</span>
											<span>
												Recibirás un email de confirmación en <strong>{formData.email}</strong>
											</span>
										</li>
										<li className="flex gap-2">
											<span className="text-warning">✓</span>
											<span>El equipo de staff revisará tu solicitud en el plazo de 48 horas</span>
										</li>
										<li className="flex gap-2">
											<span className="text-warning">✓</span>
											<span>Serás notificado por email cuando tu organización sea aprobada o rechazada</span>
										</li>
									</ul>
								</div>
							</div>
							<p className="text-xs text-muted mb-6">Redirigiendo...</p>
							<adc-skeleton variant="rectangular" height="32px" width="180px" />
						</div>
					) : (
						<form onSubmit={handleSubmit} className="space-y-6">
							{/* Organization Name Field */}
							<div className="space-y-2">
								<label htmlFor="orgName" className="block text-sm font-semibold text-text">
									Nombre de la Organización <span className="text-danger">*</span>
								</label>
								<input
									id="orgName"
									name="orgName"
									type="text"
									placeholder="ej: ACME Corporation"
									value={formData.orgName}
									onChange={handleChange}
									className="w-full px-4 py-3 rounded-lg border border-border bg-background text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
									required
								/>
								<p className="text-xs text-muted">Este será el nombre público de tu organización</p>
							</div>

							{/* Email Field */}
							<div className="space-y-2">
								<label htmlFor="email" className="block text-sm font-semibold text-text">
									Email de Contacto <span className="text-danger">*</span>
								</label>
								<input
									id="email"
									name="email"
									type="email"
									placeholder="contacto@tu-organizacion.com"
									value={formData.email}
									onChange={handleChange}
									className="w-full px-4 py-3 rounded-lg border border-border bg-background text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
									required
								/>
								<p className="text-xs text-muted">Email principal para contactar con tu organización</p>
							</div>

							{/* Description Field */}
							<div className="space-y-2">
								<label htmlFor="description" className="block text-sm font-semibold text-text">
									Descripción
								</label>
								<textarea
									id="description"
									name="description"
									placeholder="Describe brevemente tu organización y sus objetivos"
									value={formData.description}
									onChange={handleChange}
									rows={4}
									className="w-full px-4 py-3 rounded-lg border border-border bg-background text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition resize-none"
								/>
								<p className="text-xs text-muted">Máximo 500 caracteres</p>
							</div>

							{/* URL Field */}
							<div className="space-y-2">
								<label htmlFor="url" className="block text-sm font-semibold text-text">
									URL de la Organización
								</label>
								<input
									id="url"
									name="url"
									type="url"
									placeholder="https://tu-organizacion.com"
									value={formData.url}
									onChange={handleChange}
									className="w-full px-4 py-3 rounded-lg border border-border bg-background text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
								/>
								<p className="text-xs text-muted">Sitio web oficial de tu organización</p>
							</div>

							{/* Social Networks Section */}
							<div className="space-y-4 border-t border-border pt-6">
								<div className="flex items-center justify-between">
									<div>
										<h3 className="text-sm font-semibold text-text">Redes Sociales</h3>
										<p className="text-xs text-muted mt-1">Agrega canales de comunicación</p>
									</div>
									<adc-button type="button" onClick={handleAddSocialNetwork} class="!px-3 !py-2 !text-sm">
										+ Agregar
									</adc-button>
								</div>

								{/* Social Networks List */}
								{socialNetworks.length > 0 && (
									<div className="space-y-3">
										{socialNetworks.map((social) => {
											const platformConfig = socialPlatforms.find((p) => p.value === social.platform);
											return (
												<div
													key={social.id}
													className="flex gap-3 items-end p-4 rounded-lg border border-border bg-background"
												>
													{/* Platform Select */}
													<div className="flex-1 min-w-0">
														<label className="block text-xs font-semibold text-text mb-2">Plataforma</label>
														<select
															value={social.platform}
															onChange={(e) => handleSocialNetworkChange(social.id, "platform", e.target.value)}
															className="w-full px-3 py-2 rounded-lg border border-border bg-background text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
														>
															{socialPlatforms.map((p) => (
																<option key={p.value} value={p.value}>
																	{p.icon} {p.label}
																</option>
															))}
														</select>
													</div>

													{/* URL Input */}
													<div className="flex-1 min-w-0">
														<label className="block text-xs font-semibold text-text mb-2">URL</label>
														<input
															type="url"
															placeholder="https://..."
															value={social.url}
															onChange={(e) => handleSocialNetworkChange(social.id, "url", e.target.value)}
															className="w-full px-3 py-2 rounded-lg border border-border bg-background text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary transition"
														/>
													</div>

													{/* Remove Button */}
													<button
														type="button"
														onClick={() => handleRemoveSocialNetwork(social.id)}
														className="w-10 h-10 flex items-center justify-center rounded-lg border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20 transition"
														title="Eliminar red social"
													>
														<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path
																strokeLinecap="round"
																strokeLinejoin="round"
																strokeWidth={2}
																d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
															/>
														</svg>
													</button>
												</div>
											);
										})}
									</div>
								)}

								{socialNetworks.length === 0 && (
									<p className="text-xs text-muted italic">
										Sin redes sociales agregadas aún. Haz clic en "Agregar" para añadir canales de comunicación.
									</p>
								)}
							</div>

							{/* Info Box */}
							<div className="bg-info/10 border border-info/20 rounded-lg p-4">
								<div className="flex gap-3">
									<div className="w-5 h-5 flex-shrink-0">
										<svg className="w-5 h-5 text-info" fill="currentColor" viewBox="0 0 20 20">
											<path
												fillRule="evenodd"
												d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
												clipRule="evenodd"
											/>
										</svg>
									</div>
									<div>
										<p className="text-sm text-text">
											Podrás invitar miembros a tu organización después de crearla, y configurar aplicaciones específicas
											según tus necesidades.
										</p>
									</div>
								</div>
							</div>

							{/* Buttons */}
							<div className="flex gap-3 pt-4">
								<adc-button type="button" onClick={() => router.navigate("/")} class="flex-1">
									Cancelar
								</adc-button>
								<adc-button type="submit" class="flex-1">
									Crear Organización
								</adc-button>
							</div>
						</form>
					)}
				</div>

				{/* Info Cards */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
					<div className="bg-surface rounded-xl p-6 border border-border">
						<div className="text-3xl mb-3">👥</div>
						<h3 className="font-semibold text-text mb-2">Colaboración</h3>
						<p className="text-sm text-muted">Invita a tu equipo y gestiona permisos</p>
					</div>

					<div className="bg-surface rounded-xl p-6 border border-border">
						<div className="text-3xl mb-3">⚙️</div>
						<h3 className="font-semibold text-text mb-2">Aplicaciones</h3>
						<p className="text-sm text-muted">Configura las apps que necesitas</p>
					</div>

					<div className="bg-surface rounded-xl p-6 border border-border">
						<div className="text-3xl mb-3">📊</div>
						<h3 className="font-semibold text-text mb-2">Análitica</h3>
						<p className="text-sm text-muted">Monitorea el desempeño de tu org</p>
					</div>
				</div>
			</div>
		</div>
	);
}
