import React from 'react';

// UI Library no es standalone, pero necesita un App.tsx como entry point
// Los componentes individuales se exportan desde src/components/
export default function App() {
	return (
		<div>
			<h1>UI Library</h1>
			<p>Esta es una librería de componentes compartidos.</p>
		</div>
	);
}

