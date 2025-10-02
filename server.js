const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const NEWSLETTER_FILE = path.join(DATA_DIR, 'newsletter.json');
const CONTACTS_FILE = path.join(DATA_DIR, 'contacts.json');

async function ensureFile(filePath, fallback) {
  try {
    await fs.access(filePath);
  } catch (error) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(fallback, null, 2));
  }
}

async function readJson(filePath, fallback = []) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await ensureFile(filePath, fallback);
      return fallback;
    }
    throw error;
  }
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

function filterProducts(products, { category, color, search }) {
  const normalizedSearch = (search || '').trim().toLowerCase();
  return products.filter(product => {
    const matchesCategory = !category || category === 'all' || product.category === category;
    const matchesColor = !color || color === 'all' || product.color === color;
    const matchesSearch =
      !normalizedSearch ||
      product.name.toLowerCase().includes(normalizedSearch) ||
      product.description.toLowerCase().includes(normalizedSearch) ||
      product.notes.toLowerCase().includes(normalizedSearch);
    return matchesCategory && matchesColor && matchesSearch;
  });
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev'));

app.use('/styles', express.static(path.join(__dirname, 'styles')));
app.use('/scripts', express.static(path.join(__dirname, 'scripts')));

function sendHtml(res, file) {
  res.sendFile(path.join(__dirname, file));
}

app.get('/', (req, res) => sendHtml(res, 'index.html'));
app.get(['/checkout', '/checkout.html'], (req, res) => sendHtml(res, 'checkout.html'));

app.get('/api/products', async (req, res, next) => {
  try {
    const products = await readJson(PRODUCTS_FILE, []);
    const filtered = filterProducts(products, req.query);
    res.json(filtered);
  } catch (error) {
    next(error);
  }
});

app.get('/api/products/:id', async (req, res, next) => {
  try {
    const products = await readJson(PRODUCTS_FILE, []);
    const product = products.find(item => item.id === req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Produkt nicht gefunden' });
    }
    res.json(product);
  } catch (error) {
    next(error);
  }
});

function sanitizeCartItem(rawItem) {
  const quantity = Number.parseInt(rawItem.quantity, 10);
  return {
    id: rawItem.id,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1
  };
}

const SHIPPING_RATES = {
  express: 19,
  standard: 9.5
};

app.post('/api/orders', async (req, res, next) => {
  try {
    const { contact, address, payment, shipping, cart } = req.body;

    if (!contact?.email || !address?.firstName || !address?.lastName || !Array.isArray(cart) || !cart.length) {
      return res.status(400).json({ message: 'Bestellung ist unvollständig.' });
    }

    const products = await readJson(PRODUCTS_FILE, []);

    const lineItems = [];
    let subtotal = 0;

    cart.map(sanitizeCartItem).forEach(item => {
      const product = products.find(entry => entry.id === item.id);
      if (!product) {
        return;
      }
      const lineTotal = product.price * item.quantity;
      subtotal += lineTotal;
      lineItems.push({
        id: product.id,
        name: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        lineTotal,
        image: product.image
      });
    });

    if (!lineItems.length) {
      return res.status(400).json({ message: 'Keine gültigen Produkte im Warenkorb.' });
    }

    const shippingMethod = SHIPPING_RATES[shipping] ? shipping : 'express';
    const shippingCost = SHIPPING_RATES[shippingMethod];
    const total = subtotal + shippingCost;

    const order = {
      id: `LUM-${Date.now()}`,
      createdAt: new Date().toISOString(),
      contact: { email: contact.email },
      address,
      payment,
      shipping: shippingMethod,
      items: lineItems,
      subtotal,
      shippingCost,
      total
    };

    const orders = await readJson(ORDERS_FILE, []);
    orders.push(order);
    await writeJson(ORDERS_FILE, orders);

    res.status(201).json({ order });
  } catch (error) {
    next(error);
  }
});

app.get('/api/orders/:id', async (req, res, next) => {
  try {
    const orders = await readJson(ORDERS_FILE, []);
    const order = orders.find(entry => entry.id === req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Bestellung nicht gefunden.' });
    }
    res.json(order);
  } catch (error) {
    next(error);
  }
});

app.post('/api/newsletter', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Bitte gib eine gültige E-Mail-Adresse ein.' });
    }

    const newsletter = await readJson(NEWSLETTER_FILE, []);
    if (!newsletter.includes(email)) {
      newsletter.push(email);
      await writeJson(NEWSLETTER_FILE, newsletter);
    }

    res.status(201).json({ message: 'Bienvenue in der Private Society! Wir bestätigen deine Anmeldung per E-Mail.' });
  } catch (error) {
    next(error);
  }
});

app.post('/api/contact', async (req, res, next) => {
  try {
    const { name, email, topic, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ message: 'Bitte fülle alle Pflichtfelder aus.' });
    }

    const entries = await readJson(CONTACTS_FILE, []);
    const entry = {
      id: `REQ-${Date.now()}`,
      name,
      email,
      topic: topic || 'allgemein',
      message,
      createdAt: new Date().toISOString()
    };
    entries.push(entry);
    await writeJson(CONTACTS_FILE, entries);

    res.status(201).json({ message: 'Unser Concierge-Team meldet sich innerhalb von 24 Stunden.' });
  } catch (error) {
    next(error);
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((req, res, next) => {
  if (req.accepts('html')) {
    return res.status(404).sendFile(path.join(__dirname, 'index.html'));
  }
  res.status(404).json({ message: 'Ressource nicht gefunden.' });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ message: 'Ein unerwarteter Fehler ist aufgetreten.' });
});

app.listen(PORT, () => {
  console.log(`Lumina Éros Server läuft auf http://localhost:${PORT}`);
});
