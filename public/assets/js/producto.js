const sizeButtons = document.querySelectorAll('.product-size-button[data-producto]');
const addCartButton = document.getElementById('product-add-cart');
const priceElement = document.getElementById('product-detail-price');
const stockStatus = document.getElementById('product-stock-status');
const stockText = stockStatus?.querySelector('[data-stock-text]');

const formatPrice = (value) => {
    const price = Number.parseFloat(value);
    return Number.isFinite(price) ? price.toFixed(2) : String(value ?? '0');
};

const selectVariant = (button) => {
    if (!addCartButton || button.disabled || !button.dataset.producto) return;

    let product;

    try {
        product = JSON.parse(button.dataset.producto);
    } catch {
        return;
    }

    const stock = Math.max(0, Number.parseInt(product.stock, 10) || 0);

    sizeButtons.forEach((sizeButton) => {
        const selected = sizeButton === button;
        sizeButton.classList.toggle('active', selected);
        sizeButton.setAttribute('aria-pressed', String(selected));
    });

    addCartButton.dataset.producto = JSON.stringify(product);
    addCartButton.disabled = stock <= 0;
    addCartButton.textContent = stock > 0 ? 'Agregar al carro' : 'Sin stock';

    if (priceElement) {
        priceElement.textContent = `$${formatPrice(product.precio)}`;
    }

    if (stockStatus && stockText) {
        stockStatus.classList.toggle('product-stock-unavailable', stock <= 0);
        stockText.textContent = stock > 0
            ? `${stock} disponible${stock === 1 ? '' : 's'} en talle ${product.talle}`
            : `Sin stock en talle ${product.talle}`;
    }
};

sizeButtons.forEach((button) => {
    button.addEventListener('click', () => selectVariant(button));
});
