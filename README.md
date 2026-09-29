# Világfoci-magazin

Statikus oldal. Nincs havi díj, nincs adatbázis, nincs Lovable.

## Név

A fejléc szövege a `config.js` **3. sorában** van, a `name` mezőben. Most: `A név még nincs meg`.

## Adat

- Élő: [OpenLigaDB](https://api.openligadb.de) kulcs nélkül (Nemzetek Ligája A, Bundesliga, Premier League, LaLiga, Bajnokok Ligája, 2026-os szezon). A böngésző közvetlenül kéri, CORS engedi.
- Kiegészítő, szűk szelet: TheSportsDB ingyenes tesztkulcs (`123`), naponta csak néhány meccs.
- Címlapi címek: BBC Sport foci RSS, buildkor mentve a `data/headlines.json` fájlba. Csak cím, dátum, link.
- `data/snapshot.json`: ugyanabból az OpenLigaDB-válaszból, buildkori időbélyeggel, ha az élő kérés nem jönne össze.
- A football-data.org tokent kér. Kulcs nélkül 403-at ad, ezért onnan nincs meccs, és nincs kitalált állás.

## Helyben

Bármilyen statikus szerver a mappa gyökeréből, például `python3 -m http.server`. A fájl megnyitása `file://` alatt a fetch miatt nem elég.

## GitHub Pages

A repó `main` ágának gyökeréből megy. A név csere után elég egy commit és push.
