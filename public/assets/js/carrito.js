const btnAgregarCarrito = document.querySelectorAll('.btn-agregar-al-carrito');
const btnCarrito = document.getElementById('btn-carrito');

let carro = [];

const guardarCarrito = (carrito) => {
    localStorage.setItem('carrito', JSON.stringify(carrito));
};

if (localStorage.getItem('carrito')){
    const carroExistente = JSON.parse(localStorage.getItem('carrito'))

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
                cantidad:document.getElementById('cantidad').value,
                precio: producto.precio
            };
            console.log('Producto id a agregar: ', prod.id);
            if (result.isConfirmed) {
                    
                const productoExistente = carro.find((element) => element.id === prod.id);
                    
                if (productoExistente) {
                    productoExistente.cantidad = Number(productoExistente.cantidad) + Number(prod.cantidad);
                } else{
                    console.log('Carro vacío');
                    carro.push(prod);
                    console.log('Productoa gregado');
                }
                let totalProductos = 0;
                const cantidad = carro.forEach((prod) => {
                    totalProductos+=Number(prod.cantidad)
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
        total.textContent = Number(inputCantidad.value)*Number(precio);
    });
}

function renderBotonesCarrito() { //Renderizado de los botones por cada producto en el carro siempre y cuando haya productos en el mismo
    let html = "";
    if (localStorage.getItem('carrito')){
        
        //Pendiente: obtener la sesión de usuario en el script
        
        html += `
        <% if (user) { %>
            <button class="btn btn-success btn-sm" id="btnPagarCarritoSideBar" style="padding: 5px; color: black;"><a href="https://www.mercadopago.com.ar/" target="_blank" style="color: inherit; text-decoration: none; font-family: Fjalla One;">Ir a pagar</a></button>
        <% } else { %>
            <form>Iniciar sesión</form>
        <% } %>
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
            <div class="divSubtotalSidebar d-flex flex-row">
                <h6>Subtotal: $ <span id="subtotal-sidebar"></span> </h6>
                <span class="spanSubtotal"></span>
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
        
        productos.forEach((producto)=>{
            subtotal += Number(producto.precio)*Number(producto.cantidad);

            const li = document.createElement('li');
            li.className = `producto-${producto.id}`;
            li.innerHTML = `
                <h6>Producto: ${producto.nombre}</h6>
                <h6>Precio por unidad: ${producto.precio}</h6>
                <h6>Cantidad: ${producto.cantidad}</h6>
                <h6>Total: $${Number(producto.cantidad)*Number(producto.precio)}</h6>
            `;

            ul.appendChild(li);
        });
        
        document.querySelector('.divListaProductos').appendChild(ul);
        document.getElementById('subtotal-sidebar').textContent = subtotal;
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
                    title: "Deleted!",
                    text: "Your file has been deleted.",
                    icon: "success"
                });

                localStorage.clear('carrito');
                document.getElementById('subtotal-sidebar').textContent = 0;
                document.getElementById('sideBarBody').innerHTML=`
                    <h6>Carrito vacío</h6>
                `
            });

    });
    } 
});
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