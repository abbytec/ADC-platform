import "@ui-library/utils/react-jsx";
import type { Ticket } from "../../types";

interface TicketCardProps {
	ticket: Ticket;
}

export default function TicketCard({ ticket }: TicketCardProps) {
	const statusConfig = {
		pending: {
			label: "Pendiente",
			color: "warning",
			bgColor: "bg-warning/10",
			borderColor: "border-warning/30",
			icon: "⏳",
		},
		approved: {
			label: "Aprobado",
			color: "success",
			bgColor: "bg-success/10",
			borderColor: "border-success/30",
			icon: "✅",
		},
		rejected: {
			label: "Rechazado",
			color: "danger",
			bgColor: "bg-danger/10",
			borderColor: "border-danger/30",
			icon: "❌",
		},
	};

	const config = statusConfig[ticket.status];

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		return date.toLocaleDateString("es-ES", {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	return (
		<div className={`rounded-xl border-2 p-6 transition-all ${config.bgColor} ${config.borderColor}`}>
			<div className="space-y-4">
				{/* Header */}
				<div className="flex items-start justify-between gap-4">
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-3 mb-2">
							<span className="text-lg">{config.icon}</span>
							<h3 className="text-lg font-semibold text-text truncate">{ticket.title}</h3>
						</div>
						<p className="text-sm text-muted line-clamp-2">{ticket.description}</p>
					</div>

					{/* Status Badge */}
					<div
						className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap text-${config.color} bg-${config.color}/20`}
					>
						{config.label}
					</div>
				</div>

				{/* Footer */}
				<div className="flex flex-wrap items-center justify-between gap-4 text-xs text-muted border-t border-current border-opacity-10 pt-4">
					<div className="flex items-center gap-2">
						<span className="inline-block w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xxs font-semibold">
							{ticket.createdBy.name.charAt(0).toUpperCase()}
						</span>
						<span>
							{ticket.createdBy.name} • {formatDate(ticket.createdAt)}
						</span>
					</div>

					<span className="font-mono">#{ticket.id.slice(-4)}</span>
				</div>
			</div>
		</div>
	);
}
