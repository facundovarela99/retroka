const btnAgregarCarrito = document.querySelectorAll('.btn-agregar-al-carrito');
const btnCarrito = document.getElementById('btn-carrito');

const loggedIn = window.APP_STATE?.loggedIn || null;
const carritoInicial = window.APP_STATE?.carroUsuario || [];
const baseUrl = window.APP_STATE?.baseUrl || '';
const csrf_token = window.APP_STATE?.csrf_token || "";
let carro = [];

const contadorCarrito = document.getElementById('carrito-cantidad');

const actualizarContadorCarrito = (cantidad) => {
    const total = Math.max(0, Number.parseInt(cantidad, 10) || 0);

    if (contadorCarrito) {
        contadorCarrito.textContent = String(total);
    }

    if (btnCarrito) {
        btnCarrito.setAttribute(
            'aria-label',
            `Abrir carrito: ${total} producto${total === 1 ? '' : 's'}`
        );
    }
};


const mensajeCarritoLogin = sessionStorage.getItem('mensaje-carrito');

if (mensajeCarritoLogin) {
    sessionStorage.removeItem('mensaje-carrito');
    Swal.fire('Carrito', mensajeCarritoLogin, 'info');
}


const convertirAFloat = (valor) => {
    const numero = Number.parseFloat(valor);
    return Number.isFinite(numero) ? numero : 0;
};

const redondearMoneda = (valor) => Number(convertirAFloat(valor).toFixed(2));

const formatearMoneda = (valor) => redondearMoneda(valor).toFixed(2);

const normalizarProductoCarrito = (producto) => {
    const cantidad = Number.parseInt(producto.cantidad, 10) || 0;
    const precio = redondearMoneda(producto.precio);
    const total = redondearMoneda(precio * cantidad);
    const stock = Number.parseInt(producto.stock, 10) || 0;

    return {
        ...producto,
        cantidad,
        precio,
        total,
        stock
    };
};

const guardarCarrito = (carrito) => {
    const carritoNormalizado = carrito.map(normalizarProductoCarrito);
    localStorage.setItem('carrito', JSON.stringify(carritoNormalizado));
};

const enviarProductoABase = async (form, producto) => {
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
    };

    if (csrf_token) {
        headers['x-csrf-token'] = csrf_token;
    }

    const response = await fetch(form.action, {
        method: form.method.toUpperCase(),
        credentials: 'include',
        headers,
        body: JSON.stringify({
            carrito: [producto]
        })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || 'No se pudo agregar el producto al carrito');
    }

    return data;
};

if (loggedIn && carritoInicial.length > 0) {
    let cantidad = 0;

    carritoInicial.forEach((prod) => {
        const productoNormalizado = normalizarProductoCarrito(prod);
        cantidad += productoNormalizado.cantidad;
        actualizarContadorCarrito(cantidad);
        carro.push(productoNormalizado);
    })
} else if (localStorage.getItem('carrito')) {
    const carroExistente = JSON.parse(localStorage.getItem('carrito'))

    let cantidad = 0;

    carroExistente.forEach((prod) => {
        const productoNormalizado = normalizarProductoCarrito(prod);
        cantidad += productoNormalizado.cantidad;
        actualizarContadorCarrito(cantidad);
        carro.push(productoNormalizado);
    })

    guardarCarrito(carro);
}

btnAgregarCarrito.forEach((btn) => {
    btn.addEventListener('click', () => {
        const producto = JSON.parse(btn.dataset.producto);

        Swal.fire({
            theme: 'dark',
            title: `Agregar ${producto.nombre}${producto.color ? ` - ${producto.color}` : ''}${producto.talle ? ` - Talle ${producto.talle}` : ''} al carrito`,
            html: `
                    ${crearCarritoForm(producto).outerHTML}
                    <span class="d-flex flex-row justify-content-center"><strong>Total: $<p id="totalProducto">${formatearMoneda(producto.precio)}</p></strong></span>
                `,
            didOpen: () => {
                total();
                Swal.getHtmlContainer().querySelector('#form-carrito').addEventListener('submit', (event) => {
                    event.preventDefault();
                    Swal.clickConfirm();
                });
            },
            showCancelButton: true,
            confirmButtonText: "Agregar",
            showLoaderOnConfirm: true,
            preConfirm: async () => {
                let cantidad = Number.parseInt(document.getElementById('cantidad').value, 10);
                let mensaje = null;
                const precio = convertirAFloat(producto.precio);
                const stock = Number.parseInt(producto.stock, 10);
                if (!cantidad || cantidad < 1) {
                    Swal.showValidationMessage('Ingrese una cantidad válida');
                    return false;
                }
                if (!Number.isFinite(precio) || precio <= 0) {
                    Swal.showValidationMessage('El precio del producto no es valido');
                    return false;
                }

                if (!loggedIn) {
                    const productoExistente = carro.find(
                        (element) => element.id === producto.id
                            && Number(element.variante_id) === Number(producto.variante_id)
                    );
                    const cantidadEnCarro = productoExistente?.cantidad || 0;
                    const stockDisponible = stock - cantidadEnCarro;

                    if (!stock || stockDisponible <= 0) {
                        Swal.showValidationMessage('No hay stock disponible para este producto');
                        return false;
                    }

                    if (cantidad > stockDisponible) {
                        mensaje = `Solo se agregaron ${stockDisponible} unidad/es de ${producto.nombre} por stock disponible`;
                    }

                    cantidad = Math.min(cantidad, stockDisponible);
                }

                const prod = {
                    id: producto.id,
                    variante_id:producto.variante_id,
                    nombre: producto.nombre,
                    talle: producto.talle || null,
                    color:producto.color || null,
                    cantidad,
                    precio: redondearMoneda(precio),
                    total: redondearMoneda(precio * cantidad),
                    stock,
                    mensaje
                };

                if (loggedIn) {
                    try {
                        const form = Swal.getHtmlContainer().querySelector('#form-carrito');
                        const data = await enviarProductoABase(form, prod);
                        const productoAgregado = data.productos?.[0] || prod;

                        return {
                            ...productoAgregado,
                            mensaje: data.message
                        };
                    } catch (error) {
                        Swal.showValidationMessage(error.message);
                        return false;
                    }
                }

                return prod;
            },
            allowOutsideClick: () => !Swal.isLoading()
        }).then((result) => {
            if (result.isConfirmed) {
                const { mensaje, ...prod } = result.value;

                const productoExistente = carro.find(
                    (element) => element.id === prod.id
                        && Number(element.variante_id) === Number(prod.variante_id)
                );

                if (productoExistente) {
                    productoExistente.cantidad = productoExistente.cantidad + prod.cantidad;
                    productoExistente.total = redondearMoneda(productoExistente.precio * productoExistente.cantidad);
                } else {
                    carro.push(prod);
                }
                let totalProductos = 0;
                carro.forEach((prod) => {
                    totalProductos += prod.cantidad
                });
                actualizarContadorCarrito(totalProductos);

                if (!loggedIn) {
                    guardarCarrito(carro);
                }

                Swal.fire(mensaje || "Producto agregado", "", "success");
            }
        });
    })
})

const crearCarritoForm = (producto) => {
    const swalForm = document.createElement('form');
    swalForm.id = 'form-carrito';
    swalForm.action = `${baseUrl}/carrito/agregar`;
    swalForm.method = 'post';

    swalForm.innerHTML = `
        <input type="hidden" name="csrf_token" value="${csrf_token}">
        <fieldset>
            <legend>${producto.nombre}</legend>
            ${producto.color ? `<p>Color: ${producto.color}</p>` : ''}
            ${producto.talle ? `<p>Talle: ${producto.talle}</p>` : ''}
            <legend>Stock: ${producto.stock}</legend>
            <label for="cantidad">
                Cantidad
                <input
                    type="number"
                    id="cantidad"
                    name="cantidad"
                    autocomplete="cantidad"
                    min="1"
                    value="1"
                    max="${producto.stock}"
                    required
                >
            </label>
        </fieldset>
        Precio unitario: $<span id="precio">${formatearMoneda(producto.precio)}</span>
    `;
    return swalForm;
}


const total = () => {
    let total = document.getElementById('totalProducto');
    let inputCantidad = document.getElementById('cantidad');
    let precio = convertirAFloat(document.getElementById('precio').textContent)

    inputCantidad.addEventListener('input', () => {
        const cantidad = Number.parseInt(inputCantidad.value, 10) || 0;
        total.textContent = formatearMoneda(cantidad * precio);
    });
}

function renderBotonesCarrito() { //Renderizado de los botones por cada producto en el carro siempre y cuando haya productos en el mismo
    let html = "";
    // if (document.querySelector('.sidebar-lista-productos')){

    //Pendiente: obtener la sesión de usuario en el script
    //Pendiente: generar un token con JWT para corroborar que haya un usuario logueado.
    //PENDIENTE: Preguntar si el usuario está logueado, si no, que aparezca el botón de iniciar sesión en lugar de pagar.
    
    html += `
            <button class="btn btn-success btn-sm" 
                    id="btnPagarCarritoSideBar" 
                    style="padding: 5px; color: black;">
                        <a href="https://www.mercadopago.com.ar/" 
                            target="_blank" 
                            style="color: inherit; text-decoration: none; font-family: Fjalla One;">Ir a pagar
                        </a>
            </button>
            <button class="btn btn-danger btn-sm" 
                    id="btn-vaciar-carrito-sidebar" 
                    style="font-family: Fjalla One; padding: 5px; color: black"
                    data-delete-url="${loggedIn ? '/carrito/vaciar' : ''}">Vaciar carrito
            </button>`;
    // }
    return html;
}

function renderizarSidebar() {
    const bodySideBar = document.getElementById('sideBarBody');
    bodySideBar.innerHTML = `
            <div class="divHrOffcanvas">
                <hr class="hrOffcanvas">
            </div>
            <div class="divListaProductos"></div>
            <div class="divHrOffcanvas">
                <hr class="hrOffcanvas">
            </div>
            <div class="d-flex flex-column">
                <div class="divSubtotalSidebar d-flex flex-row">
                    <h6>Subtotal: $ <span id="subtotal-sidebar"></span> </h6>
                    <span class="spanSubtotal"></span>
                </div>
                <div class="divTotalProductosSidebar" d-flex flex-row>
                    <h6>Productos: <span id="totalProductosSidebar">0</span></h6>
                </div>
            </div>
            <div class="divBotonesCarrito">
                ${renderBotonesCarrito()} 
            </div>
        `;
}

function productosSidebar() {
    var productos = carro.map(normalizarProductoCarrito);

    const ul = document.createElement('ul');
    ul.className = 'sidebar-lista-productos';
    let subtotal = 0;
    let totalProductos = 0;

    if (productos.length === 0) {
        document.getElementById('sideBarBody').innerHTML = `<h6>Carrito vacío</h6>`;
        actualizarContadorCarrito(0);
        return;
    }

    productos.forEach((producto) => {
        subtotal = redondearMoneda(subtotal + producto.total);
        totalProductos += producto.cantidad;

        const li = document.createElement('li');
        li.className = `producto-${producto.id}`;
        li.innerHTML = `
            <h6>Producto: ${producto.nombre}</h6>
            ${producto.talle ? `<h6>Talle: ${producto.talle}</h6>` : ''}
            <h6>Precio por unidad: $${formatearMoneda(producto.precio)}</h6>
            <h6 class="cantidad-elementos-${producto.id}">Cantidad: ${producto.cantidad}</h6>
            <h6 class="total-elemento-${producto.id}">Total: $${formatearMoneda(producto.total)}</h6>

            <div class="d-flex flex-row">
                <form class="form-producto-sidebar" data-caso="sumar" data-id="${producto.id}" method="POST" action="${baseUrl+'/carrito/agregar'}">
                    <input type="hidden" name="csrf_token" value="${csrf_token}">
                    <input type="hidden" name="carrito[0][id]" value="${producto.id}">
                    <input type="hidden" name="carrito[0][cantidad]" value="1">
                    <input type="hidden" name="carrito[0][total]" value="${producto.precio}">
                    <button type="submit" class="btn btn-success btn-sm" data-id="${producto.id}"><i class="fas fa-plus"></i></button>
                </form>

                <form class="form-producto-sidebar ms-2" data-caso="restar" data-id="${producto.id}" method="POST" action="${baseUrl+'/carrito/remover'}">
                    <input type="hidden" name="csrf_token" value="${csrf_token}">
                    <input type="hidden" name="id" value="${producto.id}">
                    <button type="submit" class="btn btn-warning btn-sm" data-id="${producto.id}"><i class="fas fa-minus"></i></button>
                </form>
                
                <form class="form-producto-sidebar ms-2" data-caso="eliminar" data-id="${producto.id}" method="POST" action="${baseUrl+'/carrito/remover'}">
                    <input type="hidden" name="csrf_token" value="${csrf_token}">
                    <input type="hidden" name="id" value="${producto.id}">
                    <input type="hidden" name="eliminar" value="true">
                    <button type="submit" class="btn btn-danger btn-sm" data-id="${producto.id}">Eliminar</button>
                </form>
            </div>

        `;

        ul.appendChild(li);
    });

    document.querySelector('.divListaProductos').appendChild(ul);
    document.getElementById('subtotal-sidebar').textContent = formatearMoneda(subtotal);
    document.getElementById('totalProductosSidebar').textContent = totalProductos;
    actualizarContadorCarrito(totalProductos);
}

const obtenerProductoDelCarro = (idProducto) => carro.find((producto) => producto.id == idProducto);

const quitarProductoDelCarro = (idProducto) => {
    carro = carro.filter((producto) => producto.id != idProducto);
};

const persistirCarroInvitado = () => {
    if (loggedIn) return;

    if (carro.length > 0) {
        guardarCarrito(carro);
    } else {
        localStorage.removeItem('carrito');
    }
};

const mostrarCarritoVacio = () => {
    carro = [];
    localStorage.removeItem('carrito');
    actualizarContadorCarrito(0);
    document.getElementById('sideBarBody').innerHTML = `<h6>Carrito vací­o</h6>`;
};

async function manejarSubmitProductoSidebar(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const caso = form.dataset.caso;
    const idProducto = form.dataset.id;
    const productoExistente = obtenerProductoDelCarro(idProducto);
    const submitter = event.submitter;

    if (!productoExistente) return;

    try {
        if (submitter) submitter.disabled = true;

        if (caso === 'sumar') {
            const stock = Number.parseInt(productoExistente.stock, 10);

            if (!loggedIn && (!Number.isFinite(stock) || stock <= 0 || productoExistente.cantidad >= stock)) {
                throw new Error('No hay stock disponible para este producto');
            }

            const productoParaEnviar = {
                ...productoExistente,
                cantidad: 1,
                total: redondearMoneda(productoExistente.precio)
            };

            if (loggedIn) await manejarProductoSidebar(productoParaEnviar, 'sumar', form);

            productoExistente.cantidad += 1;
            productoExistente.total = redondearMoneda(productoExistente.precio * productoExistente.cantidad);
            persistirCarroInvitado();
            actualizarLayout(productoExistente, 'sumar');
            return;
        }

        if (caso === 'restar') {
            if (productoExistente.cantidad > 1) {
                if (loggedIn) await manejarProductoSidebar(productoExistente, 'restar', form);

                productoExistente.cantidad -= 1;
                productoExistente.total = redondearMoneda(productoExistente.precio * productoExistente.cantidad);
                persistirCarroInvitado();
                actualizarLayout(productoExistente, 'restar');
                return;
            }

            if (carro.length > 1) {
                if (loggedIn) await manejarProductoSidebar(productoExistente, 'restar', form);

                quitarProductoDelCarro(productoExistente.id);
                persistirCarroInvitado();
                actualizarLayout(productoExistente, 'eliminar');
                document.querySelector(`.producto-${productoExistente.id}`)?.remove();
                return;
            }

            if (loggedIn) await manejarProductoSidebar(productoExistente, 'vaciar', form);
            mostrarCarritoVacio();
            return;
        }

        if (caso === 'eliminar') {
            if (loggedIn) {
                await manejarProductoSidebar(productoExistente, carro.length > 1 ? 'eliminar' : 'vaciar', form);
            }

            if (carro.length > 1) {
                quitarProductoDelCarro(productoExistente.id);
                persistirCarroInvitado();
                actualizarLayout(productoExistente, 'eliminar');
                document.querySelector(`.producto-${productoExistente.id}`)?.remove();
                return;
            }

            mostrarCarritoVacio();
        }
    } catch (error) {
        Swal.fire('Error', error.message || 'No se pudo actualizar el carrito', 'error');
    } finally {
        if (submitter) submitter.disabled = false;
    }
}

btnCarrito?.addEventListener('click', async () => {
    renderizarSidebar();
    productosSidebar();

    if (document.querySelector('.sidebar-lista-productos')) {
        document.getElementById('btn-vaciar-carrito-sidebar').addEventListener('click', () => {

            Swal.fire({
                title: "¿Desea vaciar el carro?",
                icon: "warning",
                showCancelButton: true,
                confirmButtonColor: "#3085d6",
                cancelButtonColor: "#d33",
                confirmButtonText: "Vaciar",
                cancelButtonText: "Cancelar",
                returnFocus: false,
            
            preConfirm: async () => {

                if (loggedIn) {
                    try {
                        const urlDelete = document.getElementById('btn-vaciar-carrito-sidebar').dataset.deleteUrl;
                        const response = await fetch(baseUrl+urlDelete, {
                            method: 'delete',
                            credentials: 'include',
                            headers: {
                                'Accept': 'application/json',
                                'X-Requested-With': 'XMLHttpRequest',
                                ...(csrf_token ? { 'X-CSRF-Token': csrf_token } : {})
                            }
                        });

                        const data = await response.json();
                    } catch (error) {
                        Swal.showValidationMessage(error.message);
                        return false;
                    }
                }

            },
            allowOutsideClick: () => !Swal.isLoading()
            }).then(async (result) => {

                if (result.isConfirmed) Swal.fire({
                    title: "Carrito vaciado",
                    icon: "success"
                },
                    localStorage.removeItem('carrito'),
                    carro = [],
                    document.getElementById('subtotal-sidebar').textContent = formatearMoneda(0),
                    document.getElementById('sideBarBody').innerHTML = `
                        <h6>Carrito vacío</h6>
                    `,
                    actualizarContadorCarrito(0)
                );

            })
        });

        document.querySelectorAll('.form-producto-sidebar').forEach((form) => {
            form.addEventListener('submit', manejarSubmitProductoSidebar);
        });
    }
});

function actualizarLayout(producto, caso) {
    switch (caso) {
        case 'sumar':
            var total = redondearMoneda(producto.cantidad * producto.precio);
            var subtotal = redondearMoneda(convertirAFloat(document.getElementById('subtotal-sidebar').textContent) + producto.precio);
            var totalProductos = parseInt(document.getElementById('totalProductosSidebar').textContent) + 1;
            document.querySelector(`.cantidad-elementos-${producto.id}`).innerHTML = `Cantidad: ${producto.cantidad}`;
            document.querySelector(`.total-elemento-${producto.id}`).innerHTML = `Total: $${formatearMoneda(total)}`;
            document.getElementById('subtotal-sidebar').textContent = `${formatearMoneda(subtotal)}`;
            document.getElementById('totalProductosSidebar').textContent = `${totalProductos}`;
            actualizarContadorCarrito(totalProductos);
            break;

        case 'restar':
            var total = redondearMoneda(producto.cantidad * producto.precio);
            var subtotal = redondearMoneda(convertirAFloat(document.getElementById('subtotal-sidebar').textContent) - producto.precio);
            var totalProductos = parseInt(document.getElementById('totalProductosSidebar').textContent) - 1;
            document.querySelector(`.cantidad-elementos-${producto.id}`).innerHTML = `Cantidad: ${producto.cantidad}`;
            document.querySelector(`.total-elemento-${producto.id}`).innerHTML = `Total: $${formatearMoneda(total)}`;
            document.getElementById('subtotal-sidebar').textContent = `${formatearMoneda(subtotal)}`;
            document.getElementById('totalProductosSidebar').textContent = `${totalProductos}`;
            actualizarContadorCarrito(totalProductos);
            break;

        case 'eliminar':
            var subtotal = redondearMoneda(convertirAFloat(document.getElementById('subtotal-sidebar').textContent) - producto.total);
            var totalProductos = parseInt(document.getElementById('totalProductosSidebar').textContent) - producto.cantidad;
            document.getElementById('subtotal-sidebar').innerHTML = `${formatearMoneda(subtotal)}`;
            document.getElementById('totalProductosSidebar').innerHTML = `${totalProductos}`;
            actualizarContadorCarrito(totalProductos);
        default:
            break;
    }
}


async function manejarProductoSidebar(producto, caso, form = null) {
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
    };

    if (csrf_token) {
        headers['x-csrf-token'] = csrf_token;
    }

    let url = form?.action || '';
    let method = form?.method?.toUpperCase() || 'POST';
    let body = {};

    switch (caso) {
        case 'sumar':
            url = url || `${baseUrl}/carrito/agregar`;
            body = {
                carrito: [{ id: producto.id, cantidad: 1, total: producto.precio }]
            };
            break;

        case 'restar':
            url = url || `${baseUrl}/carrito/remover`;
            body = { id: producto.id };
            break;

        case 'eliminar':
            url = url || `${baseUrl}/carrito/remover`;
            body = { id: producto.id, eliminar: true };
            break;

        case 'vaciar':
            url = `${baseUrl}/carrito/vaciar`;
            method = 'DELETE';
            body = { id: producto.id };
            break;

        default:
            return null;
    }

    const response = await fetch(url, {
        method,
        credentials: 'include',
        headers,
        body: JSON.stringify(body)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || 'No se pudo actualizar el carrito');
    }

    return data;
}
