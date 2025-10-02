# Lumina Éros – Luxus Webshop

Ein vollständig gestalteter Luxus-Webshop mit erotischem Touch. Die Boutique präsentiert eine kuratierte Lingerie-Kollektion inklusive Warenkorb, Filterung, Schnellansicht sowie einem eigenständigen Checkout-Erlebnis auf Basis eines Node.js-Backends.

## Features

- Sinnlicher Onepage-Auftritt mit Hero-Sektion, Erlebniswelten und Concierge-Services
- Dynamische Produktliste mit Kategorien-, Farb- und Textsuche sowie Quickview-Modals
- Persistenter Warenkorb mit Mengensteuerung, serverseitiger Validierung und Synchronisierung
- Newsletter- und Concierge-Anfragen werden per API entgegen genommen und lokal gespeichert
- Luxuriöser Checkout mit Versand- und Zahlungsoptionen, serverseitiger Bestellvalidierung und Bestellnummern
- Express.js-API mit Produkt-, Bestell-, Newsletter- und Kontakt-Endpunkten

## Entwicklung

1. Abhängigkeiten installieren

   ```bash
   npm install
   ```

2. Entwicklungserver starten (liefert Frontend & API)

   ```bash
   npm run dev
   ```

3. Webshop aufrufen: <http://localhost:3000>
4. Checkout besuchen: <http://localhost:3000/checkout>

### API-Überblick

- `GET /api/products` – Produktübersicht mit optionalen Query-Parametern `category`, `color`, `search`
- `GET /api/products/:id` – Produktdetails
- `POST /api/orders` – Bestellung anlegen inkl. Validierung & Persistenz (`data/orders.json`)
- `GET /api/orders/:id` – Bestellung abrufen
- `POST /api/newsletter` – Newsletter-Anmeldung speichern
- `POST /api/contact` – Concierge-Anfrage registrieren

## Lizenz

Dieses Projekt dient als Demonstrator für einen luxuriösen Webshop-Auftritt.
