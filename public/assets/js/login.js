const form = document.getElementById('form-login');

form.addEventListener('submit', async (e)=>{
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    console.log(form.dataset.url);
    // const response = await fetch(form.dataset.url, {
    const response = await fetch(form.dataset.url, {
        method: 'POST',
        credentials: 'include', 
        headers: {
            'Content-Type':'application/json',
            // 'x-csrf-token': '<%= csrfToken %>'
        },
        body: JSON.stringify({email: email, password:password}),
    });

    const data = await response.json();

    if (data.error) {
        const mensaje = document.getElementById('mensaje-error');
        mensaje.textContent = data.message;
        mensaje.style.display = 'block';
        mensaje.style.color = 'red';
        setTimeout(()=>{
            mensaje.style.display = 'none';
        }, 4000)
    } else {
        window.location.href = 'productos';
    }

})