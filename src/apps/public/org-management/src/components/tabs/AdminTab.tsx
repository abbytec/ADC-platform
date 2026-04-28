import "@ui-library/utils/react-jsx";
import { useState } from "react";
import { mockTickets, mockOrganizationRequests } from "../../data/mockData";
import type { Ticket, OrganizationRequest } from "../../types";
import TicketCard from "../TicketCard";
import OrganizationRequestCard from "../OrganizationRequestCard";

interface AdminTabProps {
	slug: string;
}

type TicketFilter = "all" | "pending" | "approved" | "rejected";
type AdminTab = "tickets" | "organizations";

export default function AdminTab({ slug }: AdminTabProps) {
	const [tickets, setTickets] = useState<Ticket[]>(mockTickets);
	const [organizationRequests, setOrganizationRequests] = useState<OrganizationRequest[]>(mockOrganizationRequests);
	const [filter, setFilter] = useState<TicketFilter>("all");
	const [activeTab, setActiveTab] = useState<AdminTab>("organizations");
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [rejectReason, setRejectReason] = useState("");
	const [selectedRequestToReject, setSelectedRequestToReject] = useState<string | null>(null);

	const filteredTickets = filter === "all" ? tickets : tickets.filter((t) => t.status === filter);

	const filteredRequests = filter === "all" ? organizationRequests : organizationRequests.filter((r) => r.status === filter);

	const ticketStats = {
		total: tickets.length,
		pending: tickets.filter((t) => t.status === "pending").length,
		approved: tickets.filter((t) => t.status === "approved").length,
		rejected: tickets.filter((t) => t.status === "rejected").length,
	};

	const requestStats = {
		total: organizationRequests.length,
		pending: organizationRequests.filter((r) => r.status === "pending").length,
		approved: organizationRequests.filter((r) => r.status === "approved").length,
		rejected: organizationRequests.filter((r) => r.status === "rejected").length,
	};

	const handleApproveRequest = (id: string) => {
		setOrganizationRequests((prev) =>
			prev.map((req) => {
				if (req.id === id && req.status === "pending") {
					// Generate slug from org name
					const slug = req.orgName.toLowerCase().replace(/\s+/g, "-");
					return {
						...req,
						status: "approved" as const,
						slug,
						approvedBy: { id: "admin-001", name: "Admin Staff" },
						approvedAt: new Date().toISOString(),
					};
				}
				return req;
			})
		);
	};

	const handleRejectRequest = (id: string) => {
		setOrganizationRequests((prev) =>
			prev.map((req) => {
				if (req.id === id && req.status === "pending") {
					return {
						...req,
						status: "rejected" as const,
						rejectionReason: rejectReason || "Rechazada por el administrador",
					};
				}
				return req;
			})
		);
		setSelectedRequestToReject(null);
		setRejectReason("");
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-start justify-between gap-4">
				<div>
					<h2 className="text-2xl font-bold text-text mb-1">Administración</h2>
					<p className="text-muted">Gestiona solicitudes y tickets de tu organización</p>
				</div>

				<adc-button type="button" onClick={() => setShowCreateModal(true)}>
					+ Crear Ticket
				</adc-button>
			</div>

			{/* Tabs */}
			<div className="flex gap-2 border-b border-border">
				<button
					onClick={() => {
						setActiveTab("organizations");
						setFilter("all");
					}}
					className={`px-4 py-3 font-medium border-b-2 transition ${
						activeTab === "organizations" ? "border-primary text-primary" : "border-transparent text-muted hover:text-text"
					}`}
				>
					📋 Solicitudes de Organizaciones ({requestStats.total})
				</button>
				<button
					onClick={() => {
						setActiveTab("tickets");
						setFilter("all");
					}}
					className={`px-4 py-3 font-medium border-b-2 transition ${
						activeTab === "tickets" ? "border-primary text-primary" : "border-transparent text-muted hover:text-text"
					}`}
				>
					🎫 Tickets ({ticketStats.total})
				</button>
			</div>

			{/* Organization Requests Section */}
			{activeTab === "organizations" && (
				<div className="space-y-6">
					{/* Stats */}
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						<div className="bg-surface rounded-xl p-6 border border-border">
							<div className="text-2xl mb-2">📋</div>
							<p className="text-xs text-muted mb-1">Total</p>
							<p className="text-2xl font-bold text-text">{requestStats.total}</p>
						</div>

						<div className="bg-surface rounded-xl p-6 border border-border">
							<div className="text-2xl mb-2">⏳</div>
							<p className="text-xs text-muted mb-1">Pendientes</p>
							<p className="text-2xl font-bold text-warning">{requestStats.pending}</p>
						</div>

						<div className="bg-surface rounded-xl p-6 border border-border">
							<div className="text-2xl mb-2">✅</div>
							<p className="text-xs text-muted mb-1">Aprobadas</p>
							<p className="text-2xl font-bold text-success">{requestStats.approved}</p>
						</div>

						<div className="bg-surface rounded-xl p-6 border border-border">
							<div className="text-2xl mb-2">❌</div>
							<p className="text-xs text-muted mb-1">Rechazadas</p>
							<p className="text-2xl font-bold text-danger">{requestStats.rejected}</p>
						</div>
					</div>

					{/* Filters */}
					<div className="flex flex-wrap gap-2">
						{(["all", "pending", "approved", "rejected"] as const).map((f) => (
							<button
								key={f}
								onClick={() => setFilter(f)}
								className={`px-4 py-2 rounded-lg font-medium transition-all ${
									filter === f ? "bg-primary text-white" : "bg-surface border border-border text-text hover:border-primary"
								}`}
							>
								{f === "all" && `Todos (${requestStats.total})`}
								{f === "pending" && `Pendientes (${requestStats.pending})`}
								{f === "approved" && `Aprobadas (${requestStats.approved})`}
								{f === "rejected" && `Rechazadas (${requestStats.rejected})`}
							</button>
						))}
					</div>

					{/* Requests List */}
					<div className="space-y-4">
						{filteredRequests.length > 0 ? (
							filteredRequests.map((request) => (
								<OrganizationRequestCard
									key={request.id}
									request={request}
									onApprove={handleApproveRequest}
									onReject={() => setSelectedRequestToReject(request.id)}
								/>
							))
						) : (
							<div className="bg-surface rounded-xxl p-12 border border-border text-center">
								<div className="text-4xl mb-4">📭</div>
								<h3 className="text-lg font-semibold text-text mb-2">
									{filter === "all" ? "No hay solicitudes" : `No hay solicitudes ${filter}`}
								</h3>
								<p className="text-muted">
									{filter === "all"
										? "No hay solicitudes de organizaciones pendientes"
										: "No hay solicitudes en esta categoría"}
								</p>
							</div>
						)}
					</div>
				</div>
			)}

			{/* Tickets Section */}
			{activeTab === "tickets" && (
				<div className="space-y-6">
					{/* Stats */}
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						<div className="bg-surface rounded-xl p-6 border border-border">
							<div className="text-2xl mb-2">📋</div>
							<p className="text-xs text-muted mb-1">Total</p>
							<p className="text-2xl font-bold text-text">{ticketStats.total}</p>
						</div>

						<div className="bg-surface rounded-xl p-6 border border-border">
							<div className="text-2xl mb-2">⏳</div>
							<p className="text-xs text-muted mb-1">Pendientes</p>
							<p className="text-2xl font-bold text-warning">{ticketStats.pending}</p>
						</div>

						<div className="bg-surface rounded-xl p-6 border border-border">
							<div className="text-2xl mb-2">✅</div>
							<p className="text-xs text-muted mb-1">Aprobados</p>
							<p className="text-2xl font-bold text-success">{ticketStats.approved}</p>
						</div>

						<div className="bg-surface rounded-xl p-6 border border-border">
							<div className="text-2xl mb-2">❌</div>
							<p className="text-xs text-muted mb-1">Rechazados</p>
							<p className="text-2xl font-bold text-danger">{ticketStats.rejected}</p>
						</div>
					</div>

					{/* Filters */}
					<div className="flex flex-wrap gap-2">
						{(["all", "pending", "approved", "rejected"] as const).map((f) => (
							<button
								key={f}
								onClick={() => setFilter(f)}
								className={`px-4 py-2 rounded-lg font-medium transition-all ${
									filter === f ? "bg-primary text-white" : "bg-surface border border-border text-text hover:border-primary"
								}`}
							>
								{f === "all" && `Todos (${ticketStats.total})`}
								{f === "pending" && `Pendientes (${ticketStats.pending})`}
								{f === "approved" && `Aprobados (${ticketStats.approved})`}
								{f === "rejected" && `Rechazados (${ticketStats.rejected})`}
							</button>
						))}
					</div>

					{/* Tickets List */}
					<div className="space-y-4">
						{filteredTickets.length > 0 ? (
							filteredTickets.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} />)
						) : (
							<div className="bg-surface rounded-xxl p-12 border border-border text-center">
								<div className="text-4xl mb-4">📭</div>
								<h3 className="text-lg font-semibold text-text mb-2">
									{filter === "all" ? "No hay tickets" : `No hay tickets ${filter}`}
								</h3>
								<p className="text-muted mb-6">
									{filter === "all" ? "Crea el primer ticket para comenzar" : "No hay solicitudes en esta categoría"}
								</p>
								{filter === "all" && (
									<adc-button type="button" onClick={() => setShowCreateModal(true)}>
										Crear Primer Ticket
									</adc-button>
								)}
							</div>
						)}
					</div>
				</div>
			)}

			{/* Create Ticket Modal */}
			{showCreateModal && (
				<adc-modal open modalTitle="Crear Nuevo Ticket" size="lg" onadcClose={() => setShowCreateModal(false)}>
					<div className="p-6 space-y-4">
						<div>
							<label className="block text-sm font-semibold text-text mb-2">Título del Ticket</label>
							<input
								type="text"
								placeholder="ej: Agregar OAuth2 support"
								className="w-full px-4 py-2 rounded-lg border border-border bg-background text-text focus:outline-none focus:ring-2 focus:ring-primary"
							/>
						</div>

						<div>
							<label className="block text-sm font-semibold text-text mb-2">Descripción</label>
							<textarea
								rows={4}
								placeholder="Describe los detalles del ticket..."
								className="w-full px-4 py-2 rounded-lg border border-border bg-background text-text focus:outline-none focus:ring-2 focus:ring-primary resize-none"
							/>
						</div>

						<div className="flex gap-3 pt-4">
							<adc-button type="button" onClick={() => setShowCreateModal(false)}>
								Cancelar
							</adc-button>
							<adc-button type="button" onClick={() => setShowCreateModal(false)}>
								Crear Ticket
							</adc-button>
						</div>
					</div>
				</adc-modal>
			)}

			{/* Reject Request Modal */}
			{selectedRequestToReject && (
				<adc-modal open modalTitle="Rechazar Solicitud de Organización" size="md" onadcClose={() => setSelectedRequestToReject(null)}>
					<div className="p-6 space-y-4">
						<div>
							<label className="block text-sm font-semibold text-text mb-2">Razón del rechazo (opcional)</label>
							<textarea
								rows={3}
								placeholder="Explica por qué se rechaza esta solicitud..."
								value={rejectReason}
								onChange={(e) => setRejectReason(e.currentTarget.value)}
								className="w-full px-4 py-2 rounded-lg border border-border bg-background text-text focus:outline-none focus:ring-2 focus:ring-primary resize-none"
							/>
						</div>

						<div className="bg-danger/10 border border-danger/20 rounded-lg p-3 text-sm text-text">
							Esta acción no puede deshacerse. La organización recibirá una notificación del rechazo.
						</div>

						<div className="flex gap-3 pt-4">
							<adc-button type="button" onClick={() => setSelectedRequestToReject(null)}>
								Cancelar
							</adc-button>
							<adc-button type="button" onClick={() => handleRejectRequest(selectedRequestToReject)}>
								Rechazar Solicitud
							</adc-button>
						</div>
					</div>
				</adc-modal>
			)}
		</div>
	);
}
