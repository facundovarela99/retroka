const btnAgregarCarrito = document.querySelectorAll('.btn-agregar-al-carrito');
const btnCarrito = document.getElementById('btn-carrito');

let carro = [];

const guardarCarrito = (carrito) => {
    localStorage.setItem('carrito', JSON.stringify(carrito));
};

if (localStorage.getItem('carrito')){
    const carroExistente = JSON.parse(localStorage.getItem('carrito'))
    
    carroExistente.forEach((p)=>{
        console.log(typeof(p.cantidad))
        console.log(typeof(p.precio))
    })

    let cantidad = 0;

    carroExistente.forEach((prod)=>{
        cantidad+=Number(prod.cantidad);
        document.getElementById('carrito-cantidad').textContent = cantidad;
        carro.push(prod);
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
                    <span class="d-flex flex-row justify-content-center">Total: $<p id="totalProducto">0</p></span>
                `,
            didOpen: () => {
                total();
            },
            showCancelButton: true,
            confirmButtonText: "Agregar",
            showLoaderOnConfirm: true,
            preConfirm: async (login) => {
                try {
                    
                } catch (error) {

                }
            },
            allowOutsideClick: () => !Swal.isLoading()
        }).then((result) => {
            const prod = {
                id: producto.id,
                nombre:producto.nombre,
                cantidad:parseInt(document.getElementById('cantidad').value),
                precio: parseInt(producto.precio)
            };
            console.log('Producto id a agregar: ', prod.id);
            if (result.isConfirmed) {
                    
                const productoExistente = carro.find((element) => element.id === prod.id);
                    
                if (productoExistente) {
                    productoExistente.cantidad = productoExistente.cantidad + prod.cantidad;
                } else{
                    console.log('Carro vacío');
                    carro.push(prod);
                    console.log('Productoa gregado');
                }
                let totalProductos = 0;
                carro.forEach((prod) => {
                    totalProductos+=prod.cantidad
                });
                document.getElementById('carrito-cantidad').textContent = totalProductos;

                guardarCarrito(carro);
                console.log('Carro: ', carro);
                Swal.fire("¡Producto agregado!", "", "success");
            }
        });
    })
})

const crearCarritoForm = (producto) => {
    const swalForm = document.createElement('form');

    swalForm.innerHTML= `
        <div>
            <form id="form-carrito" action="" method="post" data-url="<%= url('/login') %>">
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
                    Precio: $<span id="precio">${producto.precio}</span>
                </form>
        </div>
    `;
    return swalForm;
}


const total = () => {
    let total = document.getElementById('totalProducto');
    let inputCantidad = document.getElementById('cantidad');
    let precio = document.getElementById('precio').textContent

    inputCantidad.addEventListener('input', ()=>{
        total.textContent = parseInt(inputCantidad.value)*parseInt(precio);
    });
}

function renderBotonesCarrito() { //Renderizado de los botones por cada producto en el carro siempre y cuando haya productos en el mismo
    let html = "";
    if (localStorage.getItem('carrito')){
        
        //Pendiente: obtener la sesión de usuario en el script
        //Pendiente: generar un token con JWT para corroborar que haya un usuario logueado.
        //PENDIENTE: Preguntar si el usuario está logueado, si no, que aparezca el botón de iniciar sesión en lugar de pagar.
        html += `
            <button class="btn btn-success btn-sm" id="btnPagarCarritoSideBar" style="padding: 5px; color: black;"><a href="https://www.mercadopago.com.ar/" target="_blank" style="color: inherit; text-decoration: none; font-family: Fjalla One;">Ir a pagar</a></button>
        <button class="btn btn-danger btn-sm" id="btn-vaciar-carrito-sidebar" style="font-family: Fjalla One; padding: 5px; color: black">Vaciar carrito</button>`;
    }
    return html;
}

function renderizarSidebar(){
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

function productosSidebar(){
    if (localStorage.getItem('carrito')){
        const productos = JSON.parse(localStorage.getItem('carrito'));
        const ul = document.createElement('ul');
        ul.className = 'sidebar-lista-productos';
        let subtotal = 0;
        let totalProductos = 0;
        
        productos.forEach((producto)=>{
            subtotal += producto.precio*producto.cantidad;
            totalProductos+=producto.cantidad;

            const li = document.createElement('li');
            li.className = `producto-${producto.id}`;
            li.innerHTML = `
                <h6>Producto: ${producto.nombre}</h6>
                <h6>Precio por unidad: $${producto.precio}</h6>
                <h6 class="cantidad-elementos-${producto.id}">Cantidad: ${producto.cantidad}</h6>
                <h6 class="total-elemento-${producto.id}">Total: $${producto.cantidad*producto.precio}</h6>
                <button class="btn btn-success btn-sm SumarProductoSidebar" data-id="${producto.id}"><i class="fas fa-plus"></i></button>
                <button class="btn btn-warning btn-sm RestarProductoSidebar" data-id="${producto.id}"><i class="fas fa-minus"></i></button>
                <button class="btn btn-danger btn-sm EliminarProductoSidebar" data-id="${producto.id}">Eliminar</button>
            `;

            ul.appendChild(li);
        });
        
        document.querySelector('.divListaProductos').appendChild(ul);
        document.getElementById('subtotal-sidebar').textContent = subtotal;
        document.getElementById('totalProductosSidebar').textContent = totalProductos;
    }
}

btnCarrito.addEventListener('click', ()=>{
    if (localStorage.getItem('carrito')){
        renderizarSidebar();
        productosSidebar();


        document.getElementById('btn-vaciar-carrito-sidebar').addEventListener('click', ()=>{

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
                    document.getElementById('subtotal-sidebar').textContent = 0,
                    document.getElementById('sideBarBody').innerHTML=`
                        <h6>Carrito vacío</h6>
                    `,
                    document.getElementById('carrito-cantidad').textContent = 0
                );

                });
            });

        //Debe hacer una petición por medio de AJAX a la BBDD para sumar un producto

        //No puede superar el stock disponible
        document.querySelectorAll('.SumarProductoSidebar').forEach((btn)=>{
            btn.addEventListener('click', ()=>{
                const idProducto = btn.dataset.id;

                const carrito = JSON.parse(localStorage.getItem('carrito'));

                const productoExistente = carrito.find((element) => element.id == idProducto);
                
                if (productoExistente) {
                    productoExistente.cantidad+=1;
                }

                actualizarLayout(productoExistente, 'sumar')
                guardarCarrito(carrito);
            })
        })

        //Debe hacer una petición por medio de AJAX a la BBDD para eliminar un producto

        //No puede ser menor a 0
        document.querySelectorAll('.RestarProductoSidebar').forEach((btn)=>{
            btn.addEventListener('click', ()=>{
                const idProducto = btn.dataset.id;

                const carrito = JSON.parse(localStorage.getItem('carrito'));

                const productoExistente = carrito.find((element) => element.id == idProducto);

                if (productoExistente) {
                    if (productoExistente.cantidad == 1){
                        const carritoActualizado = [];

                        carrito.forEach((producto)=>{
                            if (producto.id != idProducto) carritoActualizado.push(producto);
                        });

                        if (carritoActualizado.length === 0){
                            localStorage.clear('carrito');
                            return;
                        } else{
                            actualizarLayout(productoExistente, 'eliminar');
                            guardarCarrito(carritoActualizado);
                            const productoSidebar = document.querySelector(`.producto-${idProducto}`);
                            document.querySelector('.sidebar-lista-productos').remove(productoSidebar);
                            return;
                        }
                        
                    }
                    productoExistente.cantidad-=1;
                    actualizarLayout(productoExistente, 'restar');
                }

                guardarCarrito(carrito);
            })
        });

        document.querySelectorAll('.EliminarProductoSidebar').forEach((btn)=>{
            btn.addEventListener('click', ()=>{
                const idProducto = btn.dataset.id;

                const carrito = JSON.parse(localStorage.getItem('carrito'));

                const productoExistente = carrito.find((element) => element.id == idProducto);

                const carritoActualizado = [];

                if (productoExistente) {
                    carrito.forEach((producto)=>{
                        if (producto.id != idProducto) carritoActualizado.push(producto);
                    });

                    if (carritoActualizado.length === 0){
                        localStorage.clear('carrito');
                    } else{
                        guardarCarrito(carritoActualizado);
                    }
                    const productoSidebar = document.querySelector(`.producto-${idProducto}`);
                    productoSidebar.remove();
                    actualizarLayout(productoExistente, 'eliminar')
                    return;
                }
            })
        })
    } 
});

function actualizarLayout(producto, caso){
    switch (caso) {
        case 'sumar':
            var total = producto.cantidad*producto.precio;
            var subtotal = parseFloat(document.getElementById('subtotal-sidebar').textContent)+producto.precio;
            var totalProductos = parseInt(document.getElementById('totalProductosSidebar').textContent)+1;
            document.querySelector(`.cantidad-elementos-${producto.id}`).innerHTML = `Cantidad: ${producto.cantidad}`;
            document.querySelector(`.total-elemento-${producto.id}`).innerHTML = `Total: $${total}`;
            document.getElementById('subtotal-sidebar').innerHTML = `${subtotal}`;
            document.getElementById('totalProductosSidebar').innerHTML = `${totalProductos}`;
            document.getElementById('carrito-cantidad').innerHTML = `${totalProductos}`;
            break;
        
        case 'restar':
            var total = producto.cantidad*producto.precio;
            var subtotal = parseFloat(document.getElementById('subtotal-sidebar').textContent)-producto.precio;
            var totalProductos = parseInt(document.getElementById('totalProductosSidebar').textContent)-1;
            document.querySelector(`.cantidad-elementos-${producto.id}`).innerHTML = `Cantidad: ${producto.cantidad}`;
            document.querySelector(`.total-elemento-${producto.id}`).innerHTML = `Total: $${total}`;
            document.getElementById('subtotal-sidebar').innerHTML = `${subtotal}`;
            document.getElementById('totalProductosSidebar').innerHTML = `${totalProductos}`;
            document.getElementById('carrito-cantidad').innerHTML = `${totalProductos}`;
        
        case 'eliminar':
            console.log(parseFloat(document.getElementById('subtotal-sidebar').textContent));
            console.log(producto.cantidad*producto.precio)
            var subtotal = parseFloat(document.getElementById('subtotal-sidebar').textContent)-(producto.cantidad*producto.precio);
            var totalProductos = parseInt(document.getElementById('totalProductosSidebar').textContent)-producto.cantidad;
            document.getElementById('subtotal-sidebar').innerHTML = `${subtotal}`;
            document.getElementById('totalProductosSidebar').innerHTML = `${totalProductos}`;
            document.getElementById('carrito-cantidad').innerHTML = `${totalProductos}`;
        default:
            break;
    }
}


//------------------------------------

// const btnAgregarCarrito = document.querySelectorAll('.btn-agregar-al-carrito');

// const cargarCarrito = () => {
//     const carritoGuardado = localStorage.getItem('carrito');

//     if (!carritoGuardado) {
//         return [];
//     }

//     try {
//         const carritoParseado = JSON.parse(carritoGuardado);
//         return Array.isArray(carritoParseado) ? carritoParseado : [];
//     } catch (error) {
//         console.error('No se pudo leer el carrito del localStorage', error);
//         localStorage.removeItem('carrito');
//         return [];
//     }
// };

// const guardarCarrito = (carrito) => {
//     localStorage.setItem('carrito', JSON.stringify(carrito));
// };

// let carro = cargarCarrito();

// btnAgregarCarrito.forEach((btn) => {
//     btn.addEventListener('click', () => {
//         const producto = JSON.parse(btn.dataset.producto);

//         Swal.fire({
//             theme: 'dark',
//             title: `Agregar ${producto.nombre} al carrito`,
//             html: `
//                     ${crearCarritoForm(producto).outerHTML}
//                     <span class="d-flex flex-row justify-content-center">Total: $<p id="totalProducto">0</p></span>
//                 `,
//             didOpen: () => {
//                 total();
//             },
//             showCancelButton: true,
//             confirmButtonText: "Agregar",
//             showLoaderOnConfirm: true,
//             preConfirm: async (login) => {
//                 try {
                    
//                 } catch (error) {

//                 }
//             },
//             allowOutsideClick: () => !Swal.isLoading()
//         }).then((result) => {
//             const prod = {
//                 id: producto.id,
//                 nombre: producto.nombre,
//                 cantidad: Number(document.getElementById('cantidad').value)
//             };

//             if (result.isConfirmed) {
//                 const productoExistente = carro.find((element) => element.id === prod.id);

//                 if (productoExistente) {
//                     productoExistente.cantidad += prod.cantidad;
//                 } else {
//                     carro.push(prod);
//                 }

//                 guardarCarrito(carro);
//                 console.log('Carro: ', carro);
//                 Swal.fire("¡Producto agregado!", "", "success");
//             }
//         });
//     })
// })


// const crearCarritoForm = (producto) => {
//     const swalForm = document.createElement('form');

//     swalForm.innerHTML= `
//         <div>
//             <form id="form-carrito" action="" method="post" data-url="<%= url('/login') %>">
//                     <fieldset>
//                         <legend>${producto.nombre}</legend>
//                         <legend>Stock: ${producto.stock}</legend>
//                         <label for="cantidad">
//                             Cantidad
//                             <input
//                                 type="number"
//                                 id="cantidad"
//                                 name="cantidad"
//                                 autocomplete="cantidad"
//                                 min="1"
//                                 value="1"
//                                 max="${producto.stock}"
//                                 required
//                             >
//                         </label>
//                     </fieldset>
//                     Precio: $<span id="precio">${producto.precio}</span>
//                 </form>
//         </div>
//     `;
//     return swalForm;
// }


// const total = () => {
//     let total = document.getElementById('totalProducto');
//     let inputCantidad = document.getElementById('cantidad');
//     let precio = document.getElementById('precio').textContent

//     inputCantidad.addEventListener('input', ()=>{
//         total.textContent = Number(inputCantidad.value)*Number(precio);
//     });
// }