import React, { useState, useEffect } from 'react';
import { PrimaryButton } from '@ui-library/components/PrimaryButton.js';
import { StatCard } from '@ui-library/components/StatCard.js';

// Grid para las estadísticas
function StatsGrid({ children }: { children: React.ReactNode }) {
	return (
		<div style={{ 
			display: 'grid', 
			gap: '20px', 
			gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
			marginTop: '20px'
		}}>
			{children}
		</div>
	);
}

export default function App() {
	const [stats, setStats] = useState<any>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		loadStats();
	}, []);

	async function loadStats() {
		try {
			const response = await fetch('/api/dashboard/stats');
			const result = await response.json();
			if (result.success) {
				setStats(result.data);
			}
		} catch (error) {
			console.error('Error cargando estadísticas:', error);
		} finally {
			setLoading(false);
		}
	}

	if (loading) {
		return <div className="loading">Cargando...</div>;
	}

	return (
		<div>
			<h2 style={{ marginBottom: '20px' }}>Estadísticas del Sistema</h2>
			
			<PrimaryButton onClick={() => { loadStats(); }}>
				Recargar Estadísticas
			</PrimaryButton>

			{stats && (
				<StatsGrid>
					<StatCard
						title="Usuarios Totales"
						value={stats.totalUsers}
						color="#0066cc"
					/>
					<StatCard
						title="Usuarios Activos"
						value={stats.activeUsers}
						color="#10b981"
					/>
					<StatCard
						title="Roles Diferentes"
						value={stats.totalRoles}
						color="#f59e0b"
					/>
				</StatsGrid>
			)}
		</div>
	);
}

