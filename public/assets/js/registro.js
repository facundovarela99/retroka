const API_BASE = window.APP_STATE?.GEOREF_API_BASE || "";

const selectProvincia = document.getElementById('provincia');
const selectLocalidad = document.getElementById('localidad');

// 1. Cargar las provincias al iniciar
async function cargarProvincias() {
    try {
        const response = await fetch(`${API_BASE}/provincias?campos=id,nombre&max=100`);
        const data = await response.json();

        // Ordenar alfabéticamente por nombre
        const provincias = data.provincias.sort((a, b) => a.nombre.localeCompare(b.nombre));

        provincias.forEach(prov => {
            const option = document.createElement('option');
            option.value = prov.id;
            option.textContent = prov.nombre;
            selectProvincia.appendChild(option);
        });

    } catch (error) {
        console.error('Error al cargar provincias:', error);
    }
}

// 2. Cargar localidades cuando cambia la provincia seleccionada
async function cargarLocalidades(provinciaId) {
    // Limpiar y deshabilitar el selector mientras carga
    selectLocalidad.innerHTML = '<option value="">Cargando localidades...</option>';
    selectLocalidad.disabled = true;

    if (!provinciaId) {
        selectLocalidad.innerHTML = '<option value="">Seleccione primero una provincia...</option>';
        return;
    }

    try {
        // Pedimos las localidades filtradas por provincia y ordenadas por nombre
        const url = `${API_BASE}/localidades?provincia=${provinciaId}&campos=id,nombre&max=5000&orden=nombre`;
        const response = await fetch(url);
        const data = await response.json();

        selectLocalidad.innerHTML = '<option value="">Seleccione una localidad...</option>';

        data.localidades.forEach(loc => {
            const option = document.createElement('option');
            option.value = loc.id;
            option.textContent = loc.nombre;
            selectLocalidad.appendChild(option);
        });

        selectLocalidad.disabled = false;
    } catch (error) {
        console.error('Error al cargar localidades:', error);
        selectLocalidad.innerHTML = '<option value="">Error al cargar localidades</option>';
    }
}

// Listeners
selectProvincia.addEventListener('change', (e) => {
    cargarLocalidades(e.target.value);
});

// Inicializar
document.addEventListener('DOMContentLoaded', cargarProvincias());
