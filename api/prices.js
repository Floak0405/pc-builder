// api/prices.js
// ─────────────────────────────────────────────────────────────
// Das ist eine "Serverless Function" – sie läuft auf Vercel,
// nicht im Browser. So umgehen wir die CORS-Blockade der Shops.
//
// Wie es funktioniert:
//   1. Browser ruft  /api/prices?id=12345  auf
//   2. Diese Funktion fragt Geizhals.de ab
//   3. Sie parst den günstigsten Preis aus dem HTML
//   4. Sie antwortet dem Browser mit JSON: { price: 299.00, shop: "..." }
// ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {

  // CORS-Header setzen – erlaubt Anfragen von deiner eigenen App
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { id } = req.query;

  // Sicherheits-Check: id muss eine Zahl sein
  if (!id || !/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'Ungültige Produkt-ID' });
  }

  try {
    const url = `https://geizhals.de/?cat=WL-${id}`;

    // Geizhals-Seite abrufen (als wäre es ein Browser)
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'de-DE,de;q=0.9',
      }
    });

    if (!response.ok) {
      throw new Error(`Geizhals antwortete mit Status ${response.status}`);
    }

    const html = await response.text();

    // Preis aus dem HTML extrahieren
    // Geizhals zeigt den besten Preis in einem span mit class "variant--price"
    // Beispiel: <span class="variant--price">249,00&nbsp;€</span>
    const priceMatch = html.match(/class="variant--price"[^>]*>([^<]+)</);

    // Shop-Name extrahieren
    const shopMatch = html.match(/class="offer__name"[^>]*>([^<]+)</);

    if (!priceMatch) {
      // Fallback: Versuche alternativen Selektor
      const altMatch = html.match(/(\d+[.,]\d{2})\s*€/);
      if (altMatch) {
        const price = parseFloat(altMatch[1].replace(',', '.'));
        return res.status(200).json({
          price,
          shop: 'Unbekannter Shop',
          source: 'geizhals.de',
          url
        });
      }
      throw new Error('Kein Preis gefunden auf der Seite');
    }

    // "249,00 €" → 249.00 (JavaScript Zahl)
    const priceText = priceMatch[1]
      .replace(/&nbsp;/g, ' ')
      .replace('€', '')
      .trim()
      .replace('.', '')   // Tausenderpunkt entfernen
      .replace(',', '.'); // Komma → Punkt für parseFloat

    const price = parseFloat(priceText);
    const shop = shopMatch ? shopMatch[1].trim() : 'Günstigster Anbieter';

    return res.status(200).json({
      price,
      shop,
      source: 'geizhals.de',
      url,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Preisabfrage fehlgeschlagen:', error.message);

    // Im Fehlerfall: Preis als "nicht verfügbar" zurückgeben
    return res.status(500).json({
      error: 'Preis konnte nicht abgerufen werden',
      message: error.message
    });
  }
}
