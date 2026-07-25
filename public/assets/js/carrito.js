const btnAgregarCarrito = document.querySelectorAll('.btn-agregar-al-carrito');
const btnCarrito = document.getElementById('btn-carrito');

const loggedIn = window.APP_STATE?.loggedIn || null;
const carritoInicial = window.APP_STATE?.carroUsuario || [];
const baseUrl = window.APP_STATE?.baseUrl || '';
const csrf_token = window.APP_STATE?.csrf_token || "";
let carro = [];

if (loggedIn) {
    console.log('Usuario logueado:', loggedIn);
    console.log('Carro inicial:', carritoInicial);
    console.log('baseUrl: ', baseUrl)
    console.log('csrfToken: ', csrf_token)
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

    return {
        ...producto,
        cantidad,
        precio,
        total
    };
};

const guardarCarrito = (carrito) => {
    const carritoNormalizado = carrito.map(normalizarProductoCarrito);
    localStorage.setItem('carrito', JSON.stringify(carritoNormalizado));
};

const enviarProductoABase = async (form, producto) => {
    const headers = {
        'Content-Type': 'application/json'
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
        document.getElementById('carrito-cantidad').textContent = cantidad;
        carro.push(productoNormalizado);
    })
} else if (localStorage.getItem('carrito')) {
    const carroExistente = JSON.parse(localStorage.getItem('carrito'))

    let cantidad = 0;

    carroExistente.forEach((prod) => {
        const productoNormalizado = normalizarProductoCarrito(prod);
        cantidad += productoNormalizado.cantidad;
        document.getElementById('carrito-cantidad').textContent = cantidad;
        carro.push(productoNormalizado);
    })

    guardarCarrito(carro);
}

btnAgregarCarrito.forEach((btn) => {
    btn.addEventListener('click', () => {
        const producto = JSON.parse(btn.dataset.producto);

        Swal.fire({
            theme: 'dark',
            title: `Agregar ${producto.nombre} al carrito`,
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
                const cantidad = Number.parseInt(document.getElementById('cantidad').value, 10);
                const precio = convertirAFloat(producto.precio);
                if (!cantidad || cantidad < 1) {
                    Swal.showValidationMessage('Ingrese una cantidad válida');
                    return false;
                }
                if (!Number.isFinite(precio) || precio <= 0) {
                    Swal.showValidationMessage('El precio del producto no es valido');
                    return false;
                }

                const prod = {
                    id: producto.id,
                    nombre: producto.nombre,
                    cantidad,
                    precio: redondearMoneda(precio),
                    total: redondearMoneda(precio * cantidad)
                };

                if (loggedIn) {
                    try {
                        const form = Swal.getHtmlContainer().querySelector('#form-carrito');
                        await enviarProductoABase(form, prod);
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
                const prod = result.value;

                const productoExistente = carro.find((element) => element.id === prod.id);

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
                document.getElementById('carrito-cantidad').textContent = totalProductos;

                if (!loggedIn) {
                    guardarCarrito(carro);
                }

                Swal.fire("¡Producto agregado!", "", "success");
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
            <button class="btn btn-success btn-sm" id="btnPagarCarritoSideBar" style="padding: 5px; color: black;"><a href="https://www.mercadopago.com.ar/" target="_blank" style="color: inherit; text-decoration: none; font-family: Fjalla One;">Ir a pagar</a></button>
        <button class="btn btn-danger btn-sm" id="btn-vaciar-carrito-sidebar" style="font-family: Fjalla One; padding: 5px; color: black">Vaciar carrito</button>`;
    // }
    return html;
}

function renderizarSidebar() {
    console.log('Renderizando sidebar')
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
        document.getElementById('carrito-cantidad').textContent = 0;
        return;
    }

    productos.forEach((producto) => {
        subtotal = redondearMoneda(subtotal + producto.total);
        totalProductos += producto.cantidad;

        const li = document.createElement('li');
        li.className = `producto-${producto.id}`;
        li.innerHTML = `
            <h6>Producto: ${producto.nombre}</h6>
            <h6>Precio por unidad: $${formatearMoneda(producto.precio)}</h6>
            <h6 class="cantidad-elementos-${producto.id}">Cantidad: ${producto.cantidad}</h6>
            <h6 class="total-elemento-${producto.id}">Total: $${formatearMoneda(producto.total)}</h6>
            <button class="btn btn-success btn-sm SumarProductoSidebar" data-id="${producto.id}"><i class="fas fa-plus"></i></button>
            <button class="btn btn-warning btn-sm RestarProductoSidebar" data-id="${producto.id}"><i class="fas fa-minus"></i></button>
            <button class="btn btn-danger btn-sm EliminarProductoSidebar" data-id="${producto.id}">Eliminar</button>
        `;

        ul.appendChild(li);
    });

    document.querySelector('.divListaProductos').appendChild(ul);
    document.getElementById('subtotal-sidebar').textContent = formatearMoneda(subtotal);
    document.getElementById('totalProductosSidebar').textContent = totalProductos;
    document.getElementById('carrito-cantidad').textContent = totalProductos;
}

btnCarrito.addEventListener('click', async () => {
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
                cancelButtonText: "Cancelar"
            }).then((result) => {

                if (result.isConfirmed) Swal.fire({
                    title: "Carrito vaciado",
                    icon: "success"
                },
                    localStorage.clear('carrito'),
                    carro = [],
                    document.getElementById('subtotal-sidebar').textContent = formatearMoneda(0),
                    document.getElementById('sideBarBody').innerHTML = `
                        <h6>Carrito vacío</h6>
                    `,
                    document.getElementById('carrito-cantidad').textContent = 0
                );

            });
        });

        //Debe hacer una petición por medio de AJAX a la BBDD para sumar un producto

        //No puede superar el stock disponible
        document.querySelectorAll('.SumarProductoSidebar').forEach((btn) => {
            btn.addEventListener('click', () => {
                const idProducto = btn.dataset.id;

                const carrito = JSON.parse(localStorage.getItem('carrito'));

                const productoExistente = carrito.find((element) => element.id == idProducto);

                if (productoExistente) {
                    productoExistente.cantidad += 1;
                    productoExistente.total = redondearMoneda(productoExistente.precio * productoExistente.cantidad);
                }

                actualizarLayout(productoExistente, 'sumar')
                guardarCarrito(carrito);
            })
        })

        //Debe hacer una petición por medio de AJAX a la BBDD para eliminar un producto

        //No puede ser menor a 0
        document.querySelectorAll('.RestarProductoSidebar').forEach((btn) => {
            btn.addEventListener('click', () => {
                const idProducto = btn.dataset.id;

                const carrito = JSON.parse(localStorage.getItem('carrito'));

                const productoExistente = carrito.find((element) => element.id == idProducto);

                if (productoExistente) {
                    if (productoExistente.cantidad == 1) {

                        if (carrito.length > 1) {
                            const carritoActualizado = [];

                            carrito.forEach((producto) => {
                                if (producto.id != productoExistente.id) carritoActualizado.push(producto);
                            });
                            actualizarLayout(productoExistente, 'eliminar');
                            guardarCarrito(carritoActualizado);
                            const productoSidebar = document.querySelector(`.producto-${idProducto}`);
                            productoSidebar.remove();
                            return;
                        } else {
                            localStorage.clear('carrito');
                            document.getElementById('carrito-cantidad').textContent = 0;
                            document.getElementById('sideBarBody').innerHTML = `<h6>Carrito vacío</h6>`
                            return;
                        }

                    } else if (productoExistente.cantidad > 1) {
                        productoExistente.cantidad -= 1;
                        productoExistente.total = redondearMoneda(productoExistente.precio * productoExistente.cantidad);
                        actualizarLayout(productoExistente, 'restar');
                    }
                }

                guardarCarrito(carrito);
            })
        });

        document.querySelectorAll('.EliminarProductoSidebar').forEach((btn) => {
            btn.addEventListener('click', () => {
                const idProducto = btn.dataset.id;

                const carrito = JSON.parse(localStorage.getItem('carrito'));

                const productoExistente = carrito.find((element) => element.id == idProducto);


                if (productoExistente) {
                    if (carrito.length > 1) {
                        const carritoActualizado = [];
                        carrito.forEach((producto) => {
                            if (producto.id != productoExistente.id) carritoActualizado.push(producto);
                        });
                        guardarCarrito(carritoActualizado);
                        actualizarLayout(productoExistente, 'eliminar');
                        const productoSidebar = document.querySelector(`.producto-${idProducto}`);
                        productoSidebar.remove();
                    } else {
                        localStorage.clear('carrito');
                        document.getElementById('sideBarBody').innerHTML = `<h6>Carrito vacío</h6>`;
                        document.getElementById('carrito-cantidad').textContent = 0;
                    }
                }
                return;
            })
        })
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
            document.getElementById('carrito-cantidad').textContent = `${totalProductos}`;
            break;

        case 'restar':
            var total = redondearMoneda(producto.cantidad * producto.precio);
            var subtotal = redondearMoneda(convertirAFloat(document.getElementById('subtotal-sidebar').textContent) - producto.precio);
            var totalProductos = parseInt(document.getElementById('totalProductosSidebar').textContent) - 1;
            console.log('total productos en resta: ', totalProductos);
            document.querySelector(`.cantidad-elementos-${producto.id}`).innerHTML = `Cantidad: ${producto.cantidad}`;
            document.querySelector(`.total-elemento-${producto.id}`).innerHTML = `Total: $${formatearMoneda(total)}`;
            console.log('subtotal antes de ser asignado: ', subtotal);
            document.getElementById('subtotal-sidebar').textContent = `${formatearMoneda(subtotal)}`;
            document.getElementById('totalProductosSidebar').textContent = `${totalProductos}`;
            document.getElementById('carrito-cantidad').textContent = `${totalProductos}`;
            break;

        case 'eliminar':
            var subtotal = redondearMoneda(convertirAFloat(document.getElementById('subtotal-sidebar').textContent) - producto.total);
            var totalProductos = parseInt(document.getElementById('totalProductosSidebar').textContent) - producto.cantidad;
            document.getElementById('subtotal-sidebar').innerHTML = `${formatearMoneda(subtotal)}`;
            document.getElementById('totalProductosSidebar').innerHTML = `${totalProductos}`;
            document.getElementById('carrito-cantidad').innerHTML = `${totalProductos}`;
        default:
            break;
    }
}
