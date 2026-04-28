import "@ui-library/utils/react-jsx";
import type { OrganizationRequest } from "../types";

interface OrganizationRequestCardProps {
	request: OrganizationRequest;
	onApprove: (id: string) => void;
	onReject: (id: string) => void;
}

export default function OrganizationRequestCard({
	request,
	onApprove,
	onReject,
}: OrganizationRequestCardProps) {
	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("es-ES", {
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const statusConfig = {
		pending: {
			badge: "⏳ Pendiente",
			bgColor: "bg-warning/10",
			borderColor: "border-warning/20",
			textColor: "text-warning",
		},
		approved: {
			badge: "✅ Aprobada",
			bgColor: "bg-success/10",
			borderColor: "border-success/20",
			textColor: "text-success",
		},
		rejected: {
			badge: "❌ Rechazada",
			bgColor: "bg-danger/10",
			borderColor: "border-danger/20",
			textColor: "text-danger",
		},
	};

	const status = statusConfig[request.status];

	return (
		<div className={`rounded-lg border p-6 ${status.bgColor} ${status.borderColor}`}>
			{/* Header */}
			<div className="flex items-start justify-between gap-4 mb-4">
				<div className="flex-1">
					<div className="flex items-center gap-2 mb-2">
						<h3 className="text-lg font-semibold text-text">{request.orgName}</h3>
						<span className={`text-xs font-medium px-2 py-1 rounded ${status.textColor}`}>
							{status.badge}
						</span>
					</div>
					<p className="text-sm text-muted">{request.email}</p>
				</div>
			</div>

			{/* Description */}
			{request.description && (
				<p className="text-sm text-text mb-4 line-clamp-2">{request.description}</p>
			)}

			{/* Details */}
			<div className="grid grid-cols-2 gap-4 mb-4 text-xs">
				<div>
					<p className="text-muted">Enviado por</p>
					<p className="font-medium text-text">{request.createdBy.email}</p>
				</div>
				<div>
					<p className="text-muted">Fecha de solicitud</p>
					<p className="font-medium text-text">{formatDate(request.createdAt)}</p>
				</div>

				{request.url && (
					<div>
						<p className="text-muted">URL</p>
						<p className="font-medium text-text truncate">
							<a href={request.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
								{request.url}
							</a>
						</p>
					</div>
				)}

				{request.slug && (
					<div>
						<p className="text-muted">Slug generado</p>
						<p className="font-medium text-text">{request.slug}</p>
					</div>
				)}

				{request.approvedAt && request.approvedBy && (
					<div className="col-span-2">
						<p className="text-muted">Aprobado por</p>
						<p className="font-medium text-text">
							{request.approvedBy.name} en {formatDate(request.approvedAt)}
						</p>
					</div>
				)}

				{request.rejectionReason && (
					<div className="col-span-2">
						<p className="text-muted">Razón del rechazo</p>
						<p className="font-medium text-text">{request.rejectionReason}</p>
					</div>
				)}
			</div>

			{/* Actions */}
			{request.status === "pending" && (
				<div className="flex gap-3 pt-4 border-t border-inherit">
					<button
						onClick={() => onReject(request.id)}
						className="flex-1 px-4 py-2 rounded-lg bg-danger/20 text-danger hover:bg-danger/30 font-medium transition text-sm"
					>
						Rechazar
					</button>
					<button
						onClick={() => onApprove(request.id)}
						className="flex-1 px-4 py-2 rounded-lg bg-success/20 text-success hover:bg-success/30 font-medium transition text-sm"
					>
						Aprobar
					</button>
				</div>
			)}
		</div>
	);
}
