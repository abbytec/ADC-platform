import React from 'react';

export default function App() {
	return (
		<div>
			<h2 style={{ marginBottom: '20px' }}>Configuración del Sistema</h2>
			
			<div style={{ display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
				<div style={{ 
					background: 'white', 
					padding: '20px', 
					borderRadius: '8px', 
					boxShadow: '0 1px 3px rgba(0,0,0,0.1)' 
				}}>
					<h3>General</h3>
					<div style={{ marginBottom: '15px' }}>
						<label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Nombre del Sitio</label>
						<input type="text" defaultValue="ADC Platform" style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
					</div>
					<div style={{ marginBottom: '15px' }}>
						<label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Idioma</label>
						<select style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
							<option>Español</option>
							<option>English</option>
						</select>
					</div>
				</div>

				<div style={{ 
					background: 'white', 
					padding: '20px', 
					borderRadius: '8px', 
					boxShadow: '0 1px 3px rgba(0,0,0,0.1)' 
				}}>
					<h3>Apariencia</h3>
					<div style={{ marginBottom: '15px' }}>
						<label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Tema</label>
						<select style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
							<option>Claro</option>
							<option>Oscuro</option>
							<option>Sistema</option>
						</select>
					</div>
				</div>
			</div>
		</div>
	);
}

