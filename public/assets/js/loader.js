(() => {
    const forms = document.querySelectorAll('[data-loader-on-submit]');
    const loader = document.querySelector('[data-page-loader]');
    const pageContent = document.querySelector('[data-page-loader-content]');
    let submittingForm = null;

    if (forms.length === 0 || !loader) return;

    const showLoader = (event) => {
        submittingForm = event.currentTarget;
        loader.hidden = false;
        loader.setAttribute('aria-hidden', 'false');
        submittingForm.setAttribute('aria-busy', 'true');
        document.body.classList.add('page-loader-active');
        pageContent?.setAttribute('inert', '');
        loader.focus({ preventScroll: true });
    };

    const hideLoader = () => {
        loader.hidden = true;
        loader.setAttribute('aria-hidden', 'true');
        submittingForm?.removeAttribute('aria-busy');
        document.body.classList.remove('page-loader-active');
        pageContent?.removeAttribute('inert');
        submittingForm = null;
    };

    forms.forEach((form) => form.addEventListener('submit', showLoader));

    window.addEventListener('pageshow', hideLoader);
})();