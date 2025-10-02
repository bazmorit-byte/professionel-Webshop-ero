const API_BASE = '';
const CART_STORAGE_KEY = 'luminaCart';

const state = {
  products: [],
  filters: {
    category: 'all',
    color: 'all',
    search: ''
  },
  cart: loadCart(),
  loadingProducts: false
};

const selectors = {
  productGrid: document.querySelector('.product-grid'),
  collectionStatus: document.querySelector('.collection-status'),
  categoryFilter: document.getElementById('categoryFilter'),
  colorFilter: document.getElementById('colorFilter'),
  searchInput: document.getElementById('searchInput'),
  searchToggle: document.querySelector('.search-toggle'),
  cartToggle: document.querySelector('.cart-toggle'),
  cartDrawer: document.querySelector('.cart-drawer'),
  cartClose: document.querySelector('.cart-close'),
  cartItems: document.querySelector('.cart-items'),
  cartTotal: document.querySelector('.cart-total'),
  cartCount: document.querySelector('.cart-count'),
  modal: document.querySelector('.modal'),
  modalClose: document.querySelector('.modal-close'),
  modalImage: document.getElementById('modalImage'),
  modalTag: document.getElementById('modalTag'),
  modalTitle: document.getElementById('productModalTitle'),
  modalDescription: document.querySelector('.modal-description'),
  modalPrice: document.querySelector('.modal-price'),
  modalColor: document.querySelector('.modal-color'),
  modalAdd: document.querySelector('.modal-add'),
  newsletterForm: document.getElementById('newsletterForm'),
  contactForm: document.getElementById('contactForm'),
  featuredButton: document.querySelector('[data-featured="true"]')
};

function sanitizeCartItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map(entry => ({
      id: entry.id,
      quantity: Number.isFinite(Number.parseInt(entry.quantity, 10))
        ? Math.max(1, Number.parseInt(entry.quantity, 10))
        : 1
    }))
    .filter(entry => Boolean(entry.id));
}

function loadCart() {
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    return stored ? sanitizeCartItems(JSON.parse(stored)) : [];
  } catch (error) {
    console.warn('LocalStorage nicht verfügbar', error);
    return [];
  }
}

function saveCart() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(sanitizeCartItems(state.cart)));
  } catch (error) {
    console.warn('Cart konnte nicht gespeichert werden', error);
  }
}

function formatPrice(amount) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

function setCollectionStatus(message, type = 'info') {
  if (!selectors.collectionStatus) return;
  selectors.collectionStatus.textContent = message;
  selectors.collectionStatus.dataset.statusType = type;
  selectors.collectionStatus.hidden = !message;
}

async function fetchProducts() {
  try {
    state.loadingProducts = true;
    setCollectionStatus('Produkte werden geladen…');
    const response = await fetch(`${API_BASE}/api/products`);
    if (!response.ok) {
      throw new Error('Produkte konnten nicht geladen werden.');
    }
    const data = await response.json();
    state.products = Array.isArray(data) ? data : [];
    populateFilters();
    renderProducts();
    syncCartWithProducts();
    if (!state.products.length) {
      setCollectionStatus('Aktuell sind keine Produkte verfügbar. Unser Atelier aktualisiert die Kollektion.', 'warning');
    } else {
      setCollectionStatus('');
    }
  } catch (error) {
    console.error(error);
    setCollectionStatus('Produkte konnten nicht geladen werden. Bitte versuche es erneut.', 'error');
  } finally {
    state.loadingProducts = false;
  }
}

function populateFilters() {
  if (!selectors.categoryFilter || !selectors.colorFilter) return;
  const categories = new Set(['all']);
  const colors = new Set(['all']);

  state.products.forEach(product => {
    categories.add(product.category);
    colors.add(product.color);
  });

  const categoryOptions = Array.from(categories)
    .map(value => `<option value="${value}">${value === 'all' ? 'Alle' : value}</option>`)
    .join('');
  const colorOptions = Array.from(colors)
    .map(value => `<option value="${value}">${value === 'all' ? 'Alle' : value}</option>`)
    .join('');

  selectors.categoryFilter.innerHTML = categoryOptions;
  selectors.colorFilter.innerHTML = colorOptions;
}

function filterProducts() {
  const { category, color, search } = state.filters;
  const normalizedSearch = search.trim().toLowerCase();

  return state.products.filter(product => {
    const matchesCategory = category === 'all' || product.category === category;
    const matchesColor = color === 'all' || product.color === color;
    const matchesSearch =
      !normalizedSearch ||
      product.name.toLowerCase().includes(normalizedSearch) ||
      product.description.toLowerCase().includes(normalizedSearch) ||
      product.notes.toLowerCase().includes(normalizedSearch);

    return matchesCategory && matchesColor && matchesSearch;
  });
}

function renderProducts() {
  if (!selectors.productGrid) return;
  const filtered = filterProducts();
  selectors.productGrid.innerHTML = '';

  if (!filtered.length) {
    selectors.productGrid.innerHTML = `<p class="empty-state">Keine Produkte gefunden. Passe deine Filter an oder kontaktiere unseren Concierge.</p>`;
    return;
  }

  filtered.forEach(product => {
    const template = document.getElementById('productCardTemplate');
    if (!template) return;
    const card = template.content.firstElementChild.cloneNode(true);

    const img = card.querySelector('img');
    img.src = product.image;
    img.alt = `${product.name} – luxuriöse Lingerie in ${product.color}`;

    card.dataset.productId = product.id;
    card.querySelector('.product-tag').textContent = product.tag;
    card.querySelector('.product-color').textContent = product.color;
    card.querySelector('.product-title').textContent = product.name;
    card.querySelector('.product-description').textContent = product.description;
    card.querySelector('.product-price').textContent = formatPrice(product.price);

    card.querySelector('.add-to-cart').addEventListener('click', () => addToCart(product.id));
    card.querySelector('.quickview').addEventListener('click', () => openModal(product.id));

    selectors.productGrid.appendChild(card);
  });
}

function getProductById(productId) {
  return state.products.find(item => item.id === productId);
}

function addToCart(productId) {
  const product = getProductById(productId);
  if (!product) {
    setCollectionStatus('Dieses Produkt ist aktuell nicht verfügbar.', 'warning');
    return;
  }

  const existing = state.cart.find(item => item.id === productId);

  if (existing) {
    existing.quantity = Math.min(existing.quantity + 1, 10);
  } else {
    state.cart.push({ id: productId, quantity: 1 });
  }

  saveCart();
  updateCartUI();
}

function removeFromCart(productId) {
  state.cart = state.cart.filter(item => item.id !== productId);
  saveCart();
  updateCartUI();
}

function updateQuantity(productId, delta) {
  const item = state.cart.find(entry => entry.id === productId);
  if (!item) return;

  const newQuantity = item.quantity + delta;
  if (newQuantity <= 0) {
    removeFromCart(productId);
  } else {
    item.quantity = Math.min(newQuantity, 10);
    saveCart();
    updateCartUI();
  }
}

function syncCartWithProducts() {
  const availableIds = new Set(state.products.map(product => product.id));
  const filteredCart = state.cart.filter(item => availableIds.has(item.id));
  if (filteredCart.length !== state.cart.length) {
    state.cart = filteredCart;
    saveCart();
  }
  updateCartUI();
}

function updateCartUI() {
  if (!selectors.cartItems || !selectors.cartTotal || !selectors.cartCount) return;

  const cartCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  selectors.cartCount.textContent = cartCount;

  if (!state.cart.length) {
    selectors.cartItems.innerHTML = '<li class="empty-state">Dein Warenkorb ist noch sinnlich leer.</li>';
    selectors.cartTotal.textContent = formatPrice(0);
    return;
  }

  if (!state.products.length) {
    selectors.cartItems.innerHTML = '<li class="empty-state">Deine Auswahl wird geladen…</li>';
    selectors.cartTotal.textContent = '—';
    return;
  }

  selectors.cartItems.innerHTML = '';
  let total = 0;

  state.cart.forEach(item => {
    const product = getProductById(item.id);
    if (!product) return;
    const lineTotal = product.price * item.quantity;
    total += lineTotal;

    const li = document.createElement('li');
    li.classList.add('cart-item');
    li.innerHTML = `
      <img src="${product.image}" alt="${product.name}">
      <div class="cart-item-details">
        <strong>${product.name}</strong>
        <span>${product.color}</span>
        <div class="cart-item-actions">
          <div class="quantity-control" aria-label="Menge für ${product.name}">
            <button type="button" aria-label="Menge reduzieren">-</button>
            <span>${item.quantity}</span>
            <button type="button" aria-label="Menge erhöhen">+</button>
          </div>
          <button class="btn tertiary remove-item" type="button">Entfernen</button>
        </div>
      </div>
    `;

    const [decreaseBtn, , increaseBtn] = li.querySelectorAll('.quantity-control button');
    decreaseBtn.addEventListener('click', () => updateQuantity(item.id, -1));
    increaseBtn.addEventListener('click', () => updateQuantity(item.id, 1));
    li.querySelector('.remove-item').addEventListener('click', () => removeFromCart(item.id));

    selectors.cartItems.appendChild(li);
  });

  selectors.cartTotal.textContent = formatPrice(total);
}

function openCart() {
  selectors.cartDrawer.classList.add('open');
  selectors.cartDrawer.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  selectors.cartDrawer.classList.remove('open');
  selectors.cartDrawer.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function openModal(productId) {
  const product = getProductById(productId);
  if (!product) return;

  selectors.modalImage.src = product.image;
  selectors.modalImage.alt = product.name;
  selectors.modalTag.textContent = product.tag;
  selectors.modalTitle.textContent = product.name;
  selectors.modalDescription.textContent = `${product.description} ${product.notes}`;
  selectors.modalPrice.textContent = formatPrice(product.price);
  selectors.modalColor.textContent = product.color;
  selectors.modalAdd.onclick = () => addToCart(productId);

  selectors.modal.classList.add('open');
  selectors.modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  selectors.modal.classList.remove('open');
  selectors.modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function handleFilters() {
  selectors.searchToggle.addEventListener('click', () => {
    selectors.searchInput.focus();
    selectors.searchInput.parentElement.classList.add('active');
    setTimeout(() => selectors.searchInput.parentElement.classList.remove('active'), 1200);
  });

  selectors.categoryFilter.addEventListener('change', event => {
    state.filters.category = event.target.value;
    renderProducts();
  });

  selectors.colorFilter.addEventListener('change', event => {
    state.filters.color = event.target.value;
    renderProducts();
  });

  selectors.searchInput.addEventListener('input', event => {
    state.filters.search = event.target.value;
    renderProducts();
  });
}

function handleDrawer() {
  selectors.cartToggle.addEventListener('click', openCart);
  selectors.cartClose.addEventListener('click', closeCart);
  selectors.cartDrawer.addEventListener('click', event => {
    if (event.target === selectors.cartDrawer) {
      closeCart();
    }
  });
}

function handleModal() {
  selectors.modalClose.addEventListener('click', closeModal);
  selectors.modal.addEventListener('click', event => {
    if (event.target === selectors.modal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeCart();
      closeModal();
    }
  });
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Anfrage fehlgeschlagen.');
  }
  return data;
}

function setFormFeedback(element, message, type = 'info') {
  if (!element) return;
  element.textContent = message;
  element.dataset.statusType = type;
}

function handleForms() {
  if (selectors.newsletterForm) {
    selectors.newsletterForm.addEventListener('submit', async event => {
      event.preventDefault();
      const emailInput = selectors.newsletterForm.querySelector('input[type="email"]');
      const feedback = selectors.newsletterForm.querySelector('.form-feedback');
      const submitBtn = selectors.newsletterForm.querySelector('button[type="submit"]');
      const email = emailInput.value.trim();
      if (!email) {
        setFormFeedback(feedback, 'Bitte gib deine E-Mail-Adresse ein.', 'error');
        return;
      }

      setFormFeedback(feedback, 'Wir melden dich an…');
      submitBtn.disabled = true;
      try {
        const data = await postJson(`${API_BASE}/api/newsletter`, { email });
        setFormFeedback(feedback, data.message, 'success');
        selectors.newsletterForm.reset();
        setTimeout(() => setFormFeedback(feedback, ''), 4000);
      } catch (error) {
        setFormFeedback(feedback, error.message, 'error');
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  if (selectors.contactForm) {
    selectors.contactForm.addEventListener('submit', async event => {
      event.preventDefault();
      const feedback = selectors.contactForm.querySelector('.form-feedback');
      const submitBtn = selectors.contactForm.querySelector('button[type="submit"]');

      const payload = {
        name: selectors.contactForm.querySelector('#contactName').value.trim(),
        email: selectors.contactForm.querySelector('#contactEmail').value.trim(),
        topic: selectors.contactForm.querySelector('#contactTopic').value,
        message: selectors.contactForm.querySelector('#contactMessage').value.trim()
      };

      if (!payload.name || !payload.email || !payload.message) {
        setFormFeedback(feedback, 'Bitte fülle alle Pflichtfelder aus.', 'error');
        return;
      }

      setFormFeedback(feedback, 'Concierge wird informiert…');
      submitBtn.disabled = true;

      try {
        const data = await postJson(`${API_BASE}/api/contact`, payload);
        setFormFeedback(feedback, data.message, 'success');
        selectors.contactForm.reset();
        setTimeout(() => setFormFeedback(feedback, ''), 5000);
      } catch (error) {
        setFormFeedback(feedback, error.message, 'error');
      } finally {
        submitBtn.disabled = false;
      }
    });
  }
}

function attachFeaturedButton() {
  if (!selectors.featuredButton) return;
  selectors.featuredButton.addEventListener('click', () => {
    if (!state.products.length) {
      setCollectionStatus('Produkte werden geladen…', 'info');
      return;
    }
    const featured = state.products.find(product => product.tag === 'Signature') || state.products[0];
    if (featured) {
      openModal(featured.id);
    }
  });
}

async function init() {
  attachFeaturedButton();
  handleFilters();
  handleDrawer();
  handleModal();
  handleForms();
  updateCartUI();
  await fetchProducts();
}

init();

window.addEventListener('pageshow', () => {
  state.cart = loadCart();
  updateCartUI();
});

window.addEventListener('storage', event => {
  if (event.key === CART_STORAGE_KEY) {
    state.cart = loadCart();
    updateCartUI();
  }
});
