const formulariosPublicarProducto = document.querySelectorAll('.form-publicar-producto');
const categorias = await obtenerCategorias() ?? [];

const loader = document.querySelector('[data-page-loader]');
const pageContent = document.querySelector('[data-page-loader-content]');

const form = document.createElement('form');

const inputCsrf = document.createElement('input');
inputCsrf.type = 'hidden';
inputCsrf.name = 'csrf_token';
inputCsrf.value = window.CSRF_TOKEN;
form.appendChild(inputCsrf);

const select = document.createElement('select');
select.id = 'categoria';
select.className = 'swal2-select';

const opcionInicial = document.createElement('option');
opcionInicial.value = '';
opcionInicial.textContent = 'Selecciona una categoría';
opcionInicial.disabled = true;
opcionInicial.selected = true;
select.appendChild(opcionInicial);
form.appendChild(select);
form.className = 'form-publicar-producto';

categorias.forEach(categoria => {
    const option = document.createElement('option');
    option.value = categoria.id;
    option.textContent = categoria.nombre;
    select.appendChild(option);
});

formulariosPublicarProducto.forEach(formulario => {
    formulario.addEventListener('submit', async function(event) {
        event.preventDefault();

        const resultado = await Swal.fire({
            title: "Selecciona una categoría",
            html: form,
            showCancelButton: true,
            preConfirm: () => {
                if (!select.value) {
                    Swal.showValidationMessage('Debes seleccionar una categoría');
                    return false;
                }

                return select.value;
            }
        });

        if (resultado.isConfirmed) {
            showLoader(formulario);
            await publicarProducto(formulario, resultado.value);
        }
    });
});

async function obtenerCategorias() {
    try{
        const response = await fetch(window.BASEURL+'/admin/categorias', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        const data = await response.json();

        return data;
    } catch(error){
        console.error('Error al obtener las categorías:', error);
        return [];
    }
}

async function publicarProducto(formulario, categoria) {
    const response = await fetch(window.BASEURL+'/admin/productos/publicar', {
        method: 'POST',
        body: JSON.stringify({
            id: formulario.elements.id.value,
            categoria,
            csrf_token: window.CSRF_TOKEN
        }),
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-CSRF-Token': window.CSRF_TOKEN,
            'x-requested-with': 'XMLHttpRequest'
        }
    })

    const data = await response.json();
    console.log('Respuesta del servidor:', data);
    if (data.type !== 'success') {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: data.message || 'Ocurrió un error al publicar el producto.',
        });
    }

    if (data.type === 'success') {
        window.location.reload();
    }
}

const showLoader = (form) => {
    loader.hidden = false;
    loader.setAttribute('aria-hidden', 'false');
    form.setAttribute('aria-busy', 'true');
    document.body.classList.add('page-loader-active');
    pageContent?.setAttribute('inert', '');
    loader.focus({ preventScroll: true });
};