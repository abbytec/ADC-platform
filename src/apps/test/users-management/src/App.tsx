import React from 'react';
import { Container } from '@ui-library/components/Container.js';
import { Header } from '@ui-library/components/Header.js';
import { PrimaryButton } from '@ui-library/components/PrimaryButton.js';

export default function App() {
  return (
    <div style={{ padding: '20px' }}>
      <Container>
        <Header
          title="Gestión de Usuarios"
          subtitle="Administra los usuarios de la plataforma"
        />
        
        <div style={{ marginTop: '20px' }}>
          <div style={{ marginBottom: '20px', padding: '15px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', color: '#15803d' }}>
            🚀 ¡Ahora estás usando React con JSX uwu real! Mucho mejor DX.
          </div>

          <p>Lista de usuarios...</p>
          
          <div style={{ marginTop: '20px' }}>
            <PrimaryButton onClick={() => console.log('Crear usuario')}>
              Crear Nuevo Usuario
            </PrimaryButton>
          </div>
        </div>
      </Container>
    </div>
  );
}

