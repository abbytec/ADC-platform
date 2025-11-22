<template>
  <div>
    <h2 style="margin-bottom: 20px;">Configuración del Sistema</h2>
    
    <adc-button ref="saveButton" style="margin-bottom: 20px;">
      Guardar Configuración
    </adc-button>

    <div style="display: grid; gap: 20px; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));">
      <adc-container>
        <h3>General</h3>
        <div class="form-group">
          <label>Nombre del Sitio</label>
          <input type="text" v-model="config.siteName" />
        </div>
        <div class="form-group">
          <label>Idioma</label>
          <select v-model="config.language">
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </div>
      </adc-container>

      <adc-container>
        <h3>Apariencia</h3>
        <div class="form-group">
          <label>Tema</label>
          <select v-model="config.theme">
            <option value="light">Claro</option>
            <option value="dark">Oscuro</option>
            <option value="system">Sistema</option>
          </select>
        </div>
      </adc-container>
    </div>

    <div style="margin-top: 30px;">
      <h3>Estadísticas de Configuración</h3>
      <div style="display: grid; gap: 20px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-top: 15px;">
        <adc-stat-card
          card-title="Opciones Configuradas"
          :value="configuredOptions"
          color="#0066cc"
        />
        <adc-stat-card
          card-title="Cambios Pendientes"
          :value="pendingChanges"
          color="#f59e0b"
        />
      </div>
    </div>
  </div>
</template>

<script>
import '@ui-library/loader';

export default {
  name: 'App',
  data() {
    return {
      config: {
        siteName: 'ADC Platform',
        language: 'es',
        theme: 'light'
      },
      configuredOptions: 3,
      pendingChanges: 0
    };
  },
  mounted() {
    // Escuchar evento del web component
    const saveButton = this.$refs.saveButton;
    if (saveButton) {
      saveButton.addEventListener('adcClick', this.handleSave);
    }
  },
  beforeUnmount() {
    // Limpiar evento
    const saveButton = this.$refs.saveButton;
    if (saveButton) {
      saveButton.removeEventListener('adcClick', this.handleSave);
    }
  },
  methods: {
    handleSave() {
      console.log('[Config] Guardando configuración:', this.config);
      this.pendingChanges = 0;
      alert('✅ Configuración guardada exitosamente');
    }
  },
  watch: {
    config: {
      handler() {
        this.pendingChanges++;
      },
      deep: true
    }
  }
}
</script>

<style>
.card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}
</style>
