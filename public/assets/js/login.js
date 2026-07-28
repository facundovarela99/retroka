const form = document.getElementById('form-login');

form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const csrfToken = document.querySelector('input[name="csrf_token"]').value;

    var carrito = [];

    if (localStorage.getItem('carrito')){
        carrito = JSON.parse(localStorage.getItem('carrito'))
    }

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    const response = await fetch(form.dataset.url, {
        method: 'POST',
        credentials: 'include', 
        headers: {
            'Content-Type':'application/json',
            'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({email: email, password:password, carrito: carrito}),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
        const mensaje = document.getElementById('mensaje-error');
        mensaje.textContent = data.message;
        mensaje.style.display = 'block';
        mensaje.style.color = 'red';
        setTimeout(()=>{
            mensaje.style.display = 'none';
        }, 4000)
    } else {
        localStorage.removeItem('carrito');

        if (data.carrito?.message && data.carrito.message !== 'Carrito creado' && data.carrito.message !== 'Carrito actualizado') {
            sessionStorage.setItem('mensaje-carrito', data.carrito.message);
        }

        window.location.href = 'productos';
    }

})
