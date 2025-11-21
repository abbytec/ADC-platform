import React, { useState, useEffect } from 'react';
import '@ui-library/loader';

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
			if (!response.ok) {
				throw new Error('API no disponible');
			}
			const result = await response.json() as { success?: boolean; data?: any };
			if (result.success) {
				setStats(result.data);
			}
		} catch (error) {
			console.log('[Home] API no disponible, usando datos mock');
			setStats({
				totalUsers: 150,
				activeUsers: 89,
				totalRoles: 8
			});
		} finally {
			setLoading(false);
		}
	}

	const handleReload = () => {
		loadStats();
	};

	if (loading) {
		return <div className="loading">Cargando...</div>;
	}

	return (
		<div>
			<h2 style={{ marginBottom: '20px' }}>Estadísticas del Sistema</h2>
			
			<adc-button onAdcClick={handleReload}>
				Recargar Estadísticas
			</adc-button>

			{stats && (
				<StatsGrid>
					<adc-stat-card
						card-title="Usuarios Totales"
						value={stats.totalUsers}
						color="#0066cc"
					/>
					<adc-stat-card
						card-title="Usuarios Activos"
						value={stats.activeUsers}
						color="#10b981"
					/>
					<adc-stat-card
						card-title="Roles Diferentes"
						value={stats.totalRoles}
						color="#f59e0b"
					/>
				</StatsGrid>
			)}
		</div>
	);
}

