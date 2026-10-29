# vilagfoci – projektmemória

## Cél
Magyar nyelvű statikus világfoci-magazin, OpenLigaDB élő eredménnyel 
README kivonat: Világfoci-magazin Statikus oldal. Nincs havi díj, nincs adatbázis, nincs Lovable. Név A fejléc szövege a `config.js` **3. sorában** van, a `name` mezőben. Most: `A név még nincs meg`.

## Döntések / LOCK-ok (közös)
- Szerkesztés csak GitHubon; a Lovable csak Publish-ra való.
- Éles lépés, publikálás, adatbázis-módosítás, e-mail, fizetés csak Andor jóváhagyásával. Fizetés: két megerősítés, csak a Pénzügy bot.
- Titok (API kulcs) soha nem kerül a repóba.
- Csendes órák: hétköznap 10:00 előtt és 22:00 után, hétvégén 11:00 előtt nincs értesítés.
- Napi ellenőrzés (hétköznap 10:15, hétvégén 11:15): technikai hibák, Sentry, tartalom, regisztráció – csak hiba esetén szól.

## Szerkezet
Fő fájlok: .agents, .claude, .gemini, .nojekyll, README.md, atvetel.html, cikk.html, cikkek.html, config.js, css, data, eredmenyek.html, img, index.html, js, kovetkezo.html

## Nyitott feladatok
- [ ] Projektmemória átnézése, kiegészítése (Andor / oldalbot)
- [ ] Napi ellenőrző rutin működik
