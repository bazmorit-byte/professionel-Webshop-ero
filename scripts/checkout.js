const API_BASE = '';
const CART_STORAGE_KEY = 'luminaCart';

const cartList = document.querySelector('.summary-items');
const subtotalEl = document.querySelector('.subtotal');
const shippingEl = document.querySelector('.shipping');
const grandTotalEl = document.querySelector('.grand-total');
const checkoutForm = document.getElementById('checkoutForm');
const yearEl = document.getElementById('year');
const summaryCard = document.querySelector('.checkout-summary');

const SHIPPING_RATES = {
  express: 19,
  standard: 9.5
};

const state = {
  cart: loadCart(),
  products: [],
  productsLoaded: false,
  productLoadError: null,
  shipping: checkoutForm?.shipping?.value || 'express'
};

yearEl.textContent = new Date().getFullYear();

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

function formatPrice(amount) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

async function hydrateProducts() {
  try {
    const response = await fetch(`${API_BASE}/api/products`);
    if (!response.ok) {
      throw new Error('Produkte konnten nicht geladen werden.');
    }
    const data = await response.json();
    state.products = Array.isArray(data) ? data : [];
    state.productsLoaded = true;
  } catch (error) {
    console.error(error);
    state.productLoadError = error;
  }
}

function mergeCartWithProducts() {
  return state.cart
    .map(item => {
      const product = state.products.find(entry => entry.id === item.id);
      if (!product) return null;
      return {
        ...product,
        quantity: item.quantity,
        lineTotal: product.price * item.quantity
      };
    })
    .filter(Boolean);
}

function renderSummary() {
  if (!cartList || !checkoutForm) return;
  const submitBtn = checkoutForm.querySelector('button[type="submit"]');
  cartList.innerHTML = '';

  if (state.productLoadError) {
    cartList.innerHTML = '<li class="empty-state">Produkte konnten nicht geladen werden. Bitte lade die Seite neu.</li>';
    subtotalEl.textContent = formatPrice(0);
    shippingEl.textContent = formatPrice(0);
    grandTotalEl.textContent = formatPrice(0);
    if (submitBtn) submitBtn.disabled = true;
    summaryCard?.classList.add('empty');
    return;
  }

  if (!state.productsLoaded) {
    cartList.innerHTML = '<li class="empty-state">Bestellübersicht wird vorbereitet…</li>';
    subtotalEl.textContent = '—';
    shippingEl.textContent = '—';
    grandTotalEl.textContent = '—';
    if (submitBtn) submitBtn.disabled = true;
    summaryCard?.classList.add('empty');
    return;
  }

  const items = mergeCartWithProducts();

  if (!items.length) {
    cartList.innerHTML = '<li class="empty-state">Dein Warenkorb ist leer. Kehre zur Kollektion zurück und entdecke neue Lieblingsstücke.</li>';
    subtotalEl.textContent = formatPrice(0);
    shippingEl.textContent = formatPrice(0);
    grandTotalEl.textContent = formatPrice(0);
    if (submitBtn) submitBtn.disabled = true;
    summaryCard?.classList.add('empty');
    return;
  }

  if (submitBtn) submitBtn.disabled = false;
  summaryCard?.classList.remove('empty');

  let subtotal = 0;

  items.forEach(item => {
    subtotal += item.lineTotal;
    const li = document.createElement('li');
    li.className = 'summary-item';
    li.innerHTML = `
      <img src="${item.image}" alt="${item.name}">
      <div>
        <strong>${item.name}</strong>
        <p>${item.color}</p>
        <small>${item.quantity} × ${formatPrice(item.price)}</small>
      </div>
    `;
    cartList.appendChild(li);
  });

  const shippingCost = SHIPPING_RATES[state.shipping] || SHIPPING_RATES.express;
  subtotalEl.textContent = formatPrice(subtotal);
  shippingEl.textContent = formatPrice(shippingCost);
  grandTotalEl.textContent = formatPrice(subtotal + shippingCost);
}

function setupShippingListener() {
  if (!checkoutForm?.shipping) return;
  Array.from(checkoutForm.shipping).forEach(option => {
    option.addEventListener('change', event => {
      state.shipping = event.target.value;
      renderSummary();
    });
  });
}

function setupCardFormatting() {
  const cardNumber = document.getElementById('cardNumber');
  const cardExpiry = document.getElementById('cardExpiry');
  const cardCvc = document.getElementById('cardCvc');

  if (cardNumber) {
    cardNumber.addEventListener('input', () => {
      cardNumber.value = cardNumber.value
        .replace(/[^\d]/g, '')
        .replace(/(.{4})/g, '$1 ')
        .trim();
    });
  }

  if (cardExpiry) {
    cardExpiry.addEventListener('input', () => {
      cardExpiry.value = cardExpiry.value
        .replace(/[^\d]/g, '')
        .replace(/(\d{2})(\d{1,2})/, '$1/$2')
        .substr(0, 5);
    });
  }

  if (cardCvc) {
    cardCvc.addEventListener('input', () => {
      cardCvc.value = cardCvc.value.replace(/[^\d]/g, '').substr(0, 4);
    });
  }
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

function getCartForApi() {
  return state.cart.map(item => ({ id: item.id, quantity: item.quantity }));
}

function validateCardFields(formData) {
  const method = formData.get('payment');
  if (method !== 'card') {
    return { method };
  }
  const rawNumber = (formData.get('cardNumber') || '').replace(/\s+/g, '');
  const holder = formData.get('cardName') || '';
  const expiry = formData.get('cardExpiry') || '';
  const cvc = formData.get('cardCvc') || '';

  if (rawNumber.length < 12 || holder.trim().length < 2 || expiry.length < 4 || cvc.length < 3) {
    throw new Error('Bitte gib vollständige Kartendaten ein.');
  }

  return {
    method,
    card: {
      holder: holder.trim(),
      last4: rawNumber.slice(-4),
      expiry
    }
  };
}

function handleCheckout() {
  if (!checkoutForm) return;
  const feedback = checkoutForm.querySelector('.form-feedback');

  checkoutForm.addEventListener('submit', async event => {
    event.preventDefault();

    if (!state.cart.length) {
      feedback.dataset.statusType = 'error';
      feedback.textContent = 'Bitte wähle Produkte aus, bevor du die Bestellung abschließt.';
      return;
    }

    const formData = new FormData(checkoutForm);

    let payment;
    try {
      payment = validateCardFields(formData);
    } catch (error) {
      feedback.dataset.statusType = 'error';
      feedback.textContent = error.message;
      return;
    }

    const orderPayload = {
      contact: {
        email: formData.get('email')
      },
      address: {
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        address: formData.get('address'),
        postal: formData.get('postal'),
        city: formData.get('city'),
        country: formData.get('country')
      },
      payment,
      shipping: state.shipping,
      cart: getCartForApi()
    };

    feedback.dataset.statusType = 'info';
    feedback.textContent = 'Wir prüfen deine Bestellung…';
    const submitBtn = checkoutForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const data = await postJson(`${API_BASE}/api/orders`, orderPayload);
      const { order } = data;
      feedback.dataset.statusType = 'success';
      feedback.textContent = `Merci! Deine Bestellnummer lautet ${order.id}. Eine Bestätigung wurde an ${order.contact.email} gesendet.`;
      localStorage.removeItem(CART_STORAGE_KEY);
      state.cart = [];
      renderSummary();
      checkoutForm.reset();
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 4500);
    } catch (error) {
      feedback.dataset.statusType = 'error';
      feedback.textContent = error.message;
    } finally {
      submitBtn.disabled = false;
    }
  });
}

async function init() {
  renderSummary();
  await hydrateProducts();
  renderSummary();
  setupShippingListener();
  setupCardFormatting();
  handleCheckout();
}

init();

window.addEventListener('pageshow', () => {
  state.cart = loadCart();
  renderSummary();
});
