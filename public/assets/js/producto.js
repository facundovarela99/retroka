const variantsData = document.getElementById('product-variants-data');
const colorButtons = [...document.querySelectorAll('.product-color-button')];
const sizeButtons = [...document.querySelectorAll('.product-size-button')];
const addCartButton = document.getElementById('product-add-cart');
const priceElement = document.getElementById('product-detail-price');
const stockStatus = document.getElementById('product-stock-status');
const stockText = stockStatus?.querySelector('[data-stock-text]');
const sizeHelp = document.getElementById('product-size-help');
const mainImage = document.getElementById('product-main-image');
const galleryControls = [...document.querySelectorAll('[data-gallery-direction]')];
const productGallery = document.querySelector('[data-product-gallery]');
const galleryThumbs = document.getElementById('product-gallery-thumbs');

const variants = (() => {
    try {
        const value = JSON.parse(variantsData?.textContent || '[]');
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
})();

const normalizeOption = (value) => String(value || '')
    .trim()
    .toLocaleLowerCase('es');

const normalizeColorName = (value) => normalizeOption(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

const swatchColors = new Map([
    ['amarillo', '#f4d03f'],
    ['azul', '#2563eb'],
    ['beige', '#d6c6a5'],
    ['blanco', '#ffffff'],
    ['bordo', '#7f1d1d'],
    ['celeste', '#7dd3fc'],
    ['gris', '#6b7280'],
    ['marron', '#7c4a2d'],
    ['morado', '#7e22ce'],
    ['naranja', '#f97316'],
    ['negro', '#111827'],
    ['rojo', '#dc2626'],
    ['rosa', '#f472b6'],
    ['verde', '#16a34a'],
    ['violeta', '#7c3aed']
]);

const swatchFor = (color) => {
    const normalized = normalizeColorName(color);

    if (/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(normalized)) {
        return normalized;
    }

    for (const [name, value] of swatchColors) {
        if (normalized.includes(name)) return value;
    }

    const hue = [...normalized].reduce(
        (total, character) => (total * 31 + character.charCodeAt(0)) % 360,
        0
    );
    return `hsl(${hue} 45% 52%)`;
};

const formatPrice = (value) => {
    const price = Number.parseFloat(value);

    return Number.isFinite(price)
        ? price.toLocaleString('es-AR', {
            minimumFractionDigits:2,
            maximumFractionDigits:2
        })
        : '0,00';
};

const setPriceRange = (availableVariants) => {
    if (!priceElement || availableVariants.length === 0) return;

    const prices = availableVariants
        .map((variant) => Number.parseFloat(variant.precio))
        .filter(Number.isFinite);

    if (prices.length === 0) return;

    const minimum = Math.min(...prices);
    const maximum = Math.max(...prices);
    priceElement.textContent = minimum === maximum
        ? `$${formatPrice(minimum)}`
        : `$${formatPrice(minimum)} - $${formatPrice(maximum)}`;
};

const resetCartSelection = (message) => {
    if (!addCartButton) return;

    addCartButton.dataset.producto = '';
    addCartButton.disabled = true;
    addCartButton.textContent = message;
};

const updateStockMessage = (message, unavailable = false) => {
    stockStatus?.classList.toggle('product-stock-unavailable', unavailable);

    if (stockText) stockText.textContent = message;
};

const updateSizeButtons = (selectedColorKey) => {
    sizeButtons.forEach((sizeButton) => {
        const matchingVariants = variants.filter(
            (variant) => normalizeOption(variant.color) === selectedColorKey
                && normalizeOption(variant.talle) === sizeButton.dataset.talleKey
        );
        const availableVariant = matchingVariants.find(
            (variant) => Number.parseInt(variant.stock, 10) > 0
        );

        const isEnabled = Boolean(selectedColorKey) && Boolean(availableVariant);

        sizeButton.disabled = !isEnabled;
        sizeButton.classList.remove('active');
        sizeButton.setAttribute('aria-pressed', 'false');
        sizeButton.dataset.varianteId = availableVariant?.variante_id || '';
        sizeButton.title = !selectedColorKey
            ? 'Primero elegí un color'
            : availableVariant
                ? `${availableVariant.stock} disponible${Number(availableVariant.stock) === 1 ? '' : 's'}`
                : matchingVariants.length > 0
                    ? 'Sin stock'
                    : 'No disponible para este color';
    });
};

let selectedColor = null;
let galleryState = { images: [], index: 0 };

const resolveVariantImages = (variant) => {
    if (!variant) return [];

    const images = Array.isArray(variant.imagenes) && variant.imagenes.length > 0
        ? variant.imagenes.map((image) => image?.url).filter(Boolean)
        : [];

    if (images.length > 0) return images;

    if (variant.imagen_archivo) return [variant.imagen_archivo];

    return ['/assets/img/product-placeholder.svg'];
};

const renderGalleryThumbs = () => {
    if (!galleryThumbs) return;

    galleryThumbs.innerHTML = '';

    galleryState.images.forEach((image, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'product-gallery-thumb';
        button.setAttribute('aria-label', `Ver imagen ${index + 1}`);
        button.setAttribute('aria-pressed', String(index === galleryState.index));
        if (index === galleryState.index) {
            button.classList.add('active');
        }

        const imageNode = document.createElement('img');
        imageNode.src = image;
        imageNode.alt = `Miniatura ${index + 1}`;
        imageNode.loading = 'lazy';
        imageNode.decoding = 'async';

        button.appendChild(imageNode);
        button.addEventListener('click', () => {
            galleryState.index = index;
            syncMainImage();
            renderGalleryThumbs();
        });

        galleryThumbs.appendChild(button);
    });
};

const syncMainImage = () => {
    if (!mainImage) return;

    const imageSource = galleryState.images[galleryState.index] || galleryState.images[0] || '/assets/img/product-placeholder.svg';
    mainImage.src = imageSource;
    mainImage.alt = `Imagen ${galleryState.index + 1} del producto`;
    mainImage.classList.toggle('product-main-image-placeholder', imageSource.endsWith('/product-placeholder.svg'));

    if (galleryControls.length > 0) {
        const hasMultipleImages = galleryState.images.length > 1;
        galleryControls.forEach((control) => {
            control.hidden = !hasMultipleImages;
        });
    }

    renderGalleryThumbs();
};

const applyVariantGallery = (variant) => {
    galleryState.images = resolveVariantImages(variant);
    galleryState.index = 0;
    syncMainImage();
};

const selectFirstVariantForColor = (colorKey) => {
    const colorVariants = variants.filter(
        (variant) => normalizeOption(variant.color) === colorKey
    );

    if (colorVariants.length === 0) {
        applyVariantGallery(null);
        return;
    }

    const preferredVariant = colorVariants.find(
        (variant) => Number.parseInt(variant.stock, 10) > 0
    ) || colorVariants[0];

    applyVariantGallery(preferredVariant);
};

colorButtons.forEach((button) => {
    const swatch = button.querySelector('.product-color-swatch');
    if (swatch) swatch.style.backgroundColor = swatchFor(button.dataset.color);

    button.addEventListener('click', () => {
        selectedColor = button.dataset.colorKey;

        colorButtons.forEach((colorButton) => {
            const selected = colorButton === button;
            colorButton.classList.toggle('active', selected);
            colorButton.setAttribute('aria-pressed', String(selected));
        });

        const colorVariants = variants.filter(
            (variant) => normalizeOption(variant.color) === selectedColor
        );
        const variantsWithStock = colorVariants.filter(
            (variant) => Number.parseInt(variant.stock, 10) > 0
        );

        if (variantsWithStock.length > 0) {
            const preferredVariant = variantsWithStock[0];
            applyVariantGallery(preferredVariant);
        } else if (colorVariants.length > 0) {
            applyVariantGallery(colorVariants[0]);
        }

        updateSizeButtons(selectedColor);
        setPriceRange(colorVariants);
        resetCartSelection(variantsWithStock.length > 0 ? 'Selecciona un talle' : 'Sin stock');

        if (sizeHelp) {
            sizeHelp.textContent = variantsWithStock.length > 0
                ? 'Elegi un talle disponible'
                : 'No hay talles con stock';
        }

        updateStockMessage(
            variantsWithStock.length > 0
                ? `Selecciona un talle para ${button.dataset.color}`
                : `Sin stock disponible en ${button.dataset.color}`,
            variantsWithStock.length === 0
        );
    });
});

if (sizeButtons.length > 0) {
    updateSizeButtons(null);
    if (sizeHelp) sizeHelp.textContent = 'Primero elegí un color';
}

sizeButtons.forEach((button) => {
    button.addEventListener('click', () => {
        if (!selectedColor || button.disabled) return;

        const variant = variants.find(
            (item) => normalizeOption(item.color) === selectedColor
                && normalizeOption(item.talle) === button.dataset.talleKey
                && Number.parseInt(item.stock, 10) > 0
        );

        if (!variant || !addCartButton) return;

        sizeButtons.forEach((sizeButton) => {
            const selected = sizeButton === button;
            sizeButton.classList.toggle('active', selected);
            sizeButton.setAttribute('aria-pressed', String(selected));
        });

        const stock = Math.max(0, Number.parseInt(variant.stock, 10) || 0);
        addCartButton.dataset.producto = JSON.stringify(variant);
        addCartButton.disabled = false;
        addCartButton.textContent = 'Agregar al carro';

        applyVariantGallery(variant);

        if (priceElement) priceElement.textContent = `$${formatPrice(variant.precio)}`;
        updateStockMessage(
            `${stock} disponible${stock === 1 ? '' : 's'} en ${variant.color}, talle ${variant.talle}`
        );
    });
});

if (productGallery && galleryControls.length > 0) {
    galleryControls.forEach((control) => {
        control.addEventListener('click', () => {
            if (galleryState.images.length <= 1) return;

            const direction = control.dataset.galleryDirection === 'next' ? 1 : -1;
            galleryState.index = (galleryState.index + direction + galleryState.images.length) % galleryState.images.length;
            syncMainImage();
        });
    });
}

if (galleryThumbs && galleryThumbs.children.length === 0 && variants.length > 0) {
    applyVariantGallery(variants[0]);
}

if (variants.length > 0 && !galleryThumbs?.children.length) {
    applyVariantGallery(variants[0]);
}
