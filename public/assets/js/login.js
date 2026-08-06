const form = document.getElementById('form-login');
const mensaje = document.getElementById('mensaje-error');

const mostrarError = (message) => {
    if (!mensaje) return;

    mensaje.textContent = message;
    mensaje.style.display = 'block';
    mensaje.style.color = 'red';
};

const obtenerCarritoLocal = () => {
    try {
        const carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
        return Array.isArray(carrito) ? carrito : [];
    } catch {
        return [];
    }
};

const enviarFormularioNativo = () => {
    HTMLFormElement.prototype.submit.call(form);
};

if (form) {
    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const submitButton = form.querySelector('button[type="submit"]');
        const formData = new FormData(form);

        if (submitButton) submitButton.disabled = true;

        try {
            const response = await fetch(form.action, {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-Token': formData.get('csrf_token') || ''
                },
                body: JSON.stringify({
                    email: formData.get('email'),
                    password: formData.get('password'),
                    carrito: obtenerCarritoLocal()
                })
            });

            const contentType = response.headers.get('content-type') || '';

            if (!contentType.includes('application/json')) {
                throw new Error('La respuesta AJAX no es JSON');
            }

            const data = await response.json();

            if (!response.ok || data.error) {
                mostrarError(data.message || 'No se pudo iniciar sesion');
                return;
            }

            localStorage.removeItem('carrito');

            if (data.carrito?.message
                && data.carrito.message !== 'Carrito creado'
                && data.carrito.message !== 'Carrito actualizado') {
                sessionStorage.setItem('mensaje-carrito', data.carrito.message);
            }

            window.location.assign(data.redirectTo || '/retroka/productos');
        } catch {
            enviarFormularioNativo();
        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    });
}
