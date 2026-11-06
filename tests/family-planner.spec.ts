import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
async function openCatalogue(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Explorer & choisir" }).click();
  await page
    .getByRole("navigation", { name: "Étapes du voyage" })
    .getByRole("button", { name: /Moalboal/ })
    .click();
}
const key = "unsoirlabas-family-planner-v1";

test("préparation et choix restent consultables après fermeture et réouverture hors ligne", async ({
  page,
  context,
}) => {
  await page
    .getByRole("button", {
      name: "Garder Pescadores Suites dans les favoris",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Avant le départ" }).click();
  await page
    .getByRole("button", {
      name: "Télécharger pour le hors connexion",
      exact: true,
    })
    .click();
  await expect(page.locator(".offline-access [role=status]")).toContainText(
    "Application disponible hors connexion",
    { timeout: 25000 },
  );
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await page.close();
  await context.setOffline(true);
  const offline = await context.newPage();
  await offline.goto("/#philippines");
  await expect(offline.locator(".fp-program-photo img").first()).toBeVisible();
  await expect
    .poll(() =>
      offline
        .locator(".fp-program-photo img")
        .first()
        .evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
    )
    .toBe(true);
  await openCatalogue(offline);
  await offline.getByLabel("Nos favoris & choix").check();
  await expect(offline.locator(".fp-card")).toHaveCount(1);
  await expect(offline.locator(".fp-card")).toContainText("Pescadores Suites");
  await offline.getByRole("button", { name: "Notre budget" }).click();
  await expect(offline.locator(".fp-budget-metrics")).toContainText("2 577,96");
});

test("une fiche modifiée dans un autre onglet ne peut pas être écrasée silencieusement", async ({
  page,
  context,
}) => {
  await page
    .getByRole("heading", { name: "Pescadores Suites", exact: true })
    .click();
  await page.getByLabel("Nos notes").fill("Mon brouillon");
  const second = await context.newPage();
  await second.route("https://tile.openstreetmap.org/**", (r) => r.abort());
  await second.goto("/#philippines");
  await openCatalogue(second);
  await second
    .getByRole("heading", { name: "Pescadores Suites", exact: true })
    .click();
  await second.getByLabel("Nos notes").fill("Autre onglet enregistré");
  await second.getByRole("button", { name: "Enregistrer mon choix" }).click();
  await page.getByRole("button", { name: "Enregistrer mon choix" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".fp-notice")).toContainText("autre onglet");
  expect(
    (await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key))
      .choices.pescadores.notes,
  ).toBe("Autre onglet enregistré");
});

test("le carnet familial est créé sur demande sans récit fictif ni doublon", async ({
  page,
}) => {
  expect(
    await page.evaluate(() =>
      localStorage.getItem("un-soir-la-bas-upcoming-v1"),
    ),
  ).toBeNull();
  await page.getByRole("button", { name: "Notre carnet ↗" }).click();
  await expect(page).toHaveURL(/#trip\/family-philippines-2027/);
  const trips = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("un-soir-la-bas-upcoming-v1")!),
  );
  expect(trips).toHaveLength(1);
  expect(trips[0].plan.stops).toHaveLength(5);
  await page.goto("/#philippines");
  await page.getByRole("button", { name: "Notre carnet ↗" }).click();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("un-soir-la-bas-upcoming-v1")!),
    ),
  ).toHaveLength(1);
});
test.beforeEach(async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
  await page.goto("/#philippines");
  await expect(
    page.getByRole("heading", { name: /Le planning/ }),
  ).toBeVisible();
  await openCatalogue(page);
});

test("un lieu personnel peut être corrigé et retiré avec son choix et son budget", async ({
  page,
}) => {
  await page.evaluate(() =>
    Object.defineProperty(globalThis, "crypto", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.getByRole("button", { name: "Ajouter une idée" }).click();
  await page.getByLabel("Nom du lieu").fill("Notre hôtel");
  await page.getByRole("button", { name: "Ajouter mon idée" }).click();
  await page.getByRole("heading", { name: "Notre hôtel", exact: true }).click();
  await page.getByLabel("Notre décision").selectOption("chosen");
  await page.getByLabel("Date d’arrivée envisagée").fill("2027-02-18");
  await page.getByLabel("Nos notes").fill("Demander un lit supplémentaire");
  await page.getByRole("button", { name: "Enregistrer mon choix" }).click();
  await page.getByRole("heading", { name: "Notre hôtel", exact: true }).click();
  await page.getByRole("button", { name: "Modifier mon lieu" }).click();
  await page.getByLabel("Nom du lieu").fill("Notre adresse corrigée");
  await page
    .getByRole("combobox", { name: "Étape", exact: true })
    .selectOption("bohol");
  await page.getByRole("button", { name: "Enregistrer mon lieu" }).click();
  const state = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!),
    key,
  );
  expect(state.custom[0].stage).toBe("bohol");
  expect(state.choices[state.custom[0].id]).toMatchObject({
    date: "",
    notes: "Demander un lit supplémentaire",
    status: "chosen",
  });
  await page
    .getByRole("navigation", { name: "Étapes du voyage" })
    .getByRole("button", { name: /Bohol/ })
    .click();
  await page
    .getByRole("heading", { name: "Notre adresse corrigée", exact: true })
    .click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Supprimer mon lieu" }).click();
  const removed = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!),
    key,
  );
  expect(removed.custom).toHaveLength(0);
  expect(Object.keys(removed.choices)).toHaveLength(0);
});

test("un stockage plein préserve la dernière préparation et signale le refus", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Garder Pescadores Suites dans les favoris" })
    .click();
  const before = await page.evaluate((k) => localStorage.getItem(k), key);
  await page.evaluate((k) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === k)
        throw new DOMException("QuotaExceededError", "QuotaExceededError");
      original.call(this, name, value);
    };
  }, key);
  await page
    .getByRole("button", { name: "Garder Parrot Resort dans les favoris" })
    .click();
  await expect(page.locator(".fp-notice")).toContainText("Stockage plein");
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(before);
});

test("une note quotidienne concurrente conserve le brouillon et la dernière sauvegarde", async ({
  page,
  context,
}) => {
  await page.getByRole("button", { name: "Jour par jour" }).click();
  const note = page.locator(".fp-day-note textarea").first();
  await note.fill("Mon brouillon encore ouvert");
  const second = await context.newPage();
  await second.goto("/#philippines");
  await second.getByRole("button", { name: "Jour par jour" }).click();
  await second
    .locator(".fp-day-note textarea")
    .first()
    .fill("Note enregistrée ailleurs");
  await second
    .getByRole("heading", { name: "Arriver, souffler, se poser" })
    .click();
  await expect
    .poll(() =>
      second.evaluate(
        (k) => JSON.parse(localStorage.getItem(k)!).dayNotes["2027-02-17"],
        key,
      ),
    )
    .toBe("Note enregistrée ailleurs");
  await page
    .getByRole("heading", { name: "Arriver, souffler, se poser" })
    .click();
  await expect(page.locator(".fp-notice")).toContainText("autre onglet");
  await expect(note).toHaveValue("Mon brouillon encore ouvert");
  expect(
    (await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key))
      .dayNotes["2027-02-17"],
  ).toBe("Note enregistrée ailleurs");
});

test("les repères groupés ouvrent chacune des fiches et la recherche filtre carte et liste", async ({
  page,
}) => {
  await page.locator('.fp-map [title="Pescadores Suites, Island Wok"]').click();
  await page
    .locator(".fp-cluster")
    .getByRole("button", { name: /Island Wok/ })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Island Wok");
  await page.keyboard.press("Escape");
  await page.getByLabel("Rechercher une option").fill("parrot");
  await expect(page.locator(".fp-card")).toHaveCount(1);
  await expect(page.locator(".fp-pin")).toHaveCount(1);
  await page.locator('.fp-map [title="Parrot Resort"]').click();
  await expect(page.getByRole("dialog")).toContainText("Parrot Resort");
});

test("chaque étape propose hôtels, restaurants et activités, en liste et sur la carte", async ({
  page,
}) => {
  for (const name of [
    "Moalboal",
    "Dauin & Apo",
    "Siquijor",
    "Bohol",
    "Mactan",
  ]) {
    await page
      .getByRole("navigation", { name: "Étapes du voyage" })
      .getByRole("button", { name: new RegExp(name) })
      .click();
    for (const category of ["Hôtels", "Restaurants", "Activités"]) {
      await page
        .getByRole("group", { name: "Catégories" })
        .getByRole("button", { name: category, exact: true })
        .click();
      expect(await page.locator(".fp-card").count()).toBeGreaterThanOrEqual(2);
      expect(await page.locator(".fp-pin").count()).toBeGreaterThan(0);
    }
  }
  await page.getByRole("button", { name: "Liste", exact: true }).click();
  await expect(page.locator(".fp-map-aside")).toBeHidden();
  await page.getByRole("button", { name: "Carte", exact: true }).last().click();
  await expect(page.locator(".fp-results")).toBeHidden();
  await page.getByText(/Liste accessible des/).click();
  await expect(page.locator(".fp-map-list button")).toHaveCount(2);
});

test("favoris, comparaison, réservation et budget survivent au rechargement", async ({
  page,
}) => {
  await page
    .getByRole("button", {
      name: "Garder Pescadores Suites dans les favoris",
      exact: true,
    })
    .click();
  await page.getByLabel("Nos favoris & choix").check();
  await expect(page.locator(".fp-card")).toHaveCount(1);
  await page.getByLabel("Nos favoris & choix").uncheck();
  for (const name of ["Pescadores Suites", "Parrot Resort"])
    await page
      .locator(".fp-card")
      .filter({ has: page.getByRole("heading", { name, exact: true }) })
      .getByLabel("Comparer")
      .check();
  await page.getByRole("button", { name: "Comparer les choix" }).click();
  await expect(page.getByRole("dialog")).toContainText("Parrot Resort");
  await page.getByRole("button", { name: "Fermer la fiche" }).click();
  await page
    .getByRole("heading", { name: "Pescadores Suites", exact: true })
    .click();
  const modal = page.getByRole("dialog");
  await modal.getByLabel("Notre décision").selectOption("booked");
  await modal.getByLabel("Date d’arrivée envisagée").fill("2027-02-17");
  await modal
    .getByLabel("Nos notes")
    .fill("Chambre familiale, arrivée anticipée à demander.");
  await modal
    .getByText("Prix, paiement et réservation", { exact: true })
    .click();
  await modal.getByLabel(/Total du séjour/).fill("440");
  await modal.getByLabel("Déjà payé pour quatre (€)").fill("100");
  await modal.getByRole("button", { name: "Enregistrer mon choix" }).click();
  await expect(modal).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Notre budget", exact: true }).click();
  await expect(page.locator(".fp-budget-metrics")).toContainText("3 017,96");
  await expect(page.locator(".fp-budget-metrics")).toContainText("100,00");
  await expect(
    page
      .getByLabel("Budget des choix par étape")
      .locator("article")
      .filter({ hasText: "Moalboal" }),
  ).toContainText("440,00");
  await page.getByRole("button", { name: "Jour par jour" }).click();
  await expect(page.locator(".fp-day-options")).toContainText([
    "Pescadores Suites",
    "",
    "",
  ]);
  const saved = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!),
    key,
  );
  expect(saved.choices.pescadores).toMatchObject({
    status: "booked",
    cost: "440",
    paid: "100",
    date: "2027-02-17",
  });
});

test("un ajout personnel est filtrable, localisé et exporté sans toucher aux carnets", async ({
  page,
}, testInfo) => {
  await page.evaluate(() =>
    localStorage.setItem("un-soir-la-bas-upcoming-v1", "[]"),
  );
  await page.getByRole("button", { name: "Ajouter une idée" }).click();
  await page
    .getByLabel("Nom du lieu")
    .fill("Notre café <script>alert(1)</script>");
  await page
    .getByRole("combobox", { name: "Catégorie", exact: true })
    .selectOption("food");
  await page.getByLabel("Ce qui nous attire").fill("Une pause au calme.");
  await page.getByRole("button", { name: "Ajouter mon idée" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Rechercher une option").fill("Notre café");
  await expect(page.locator(".fp-card")).toHaveCount(1);
  await page.getByRole("heading", { name: /Notre café/ }).click();
  await page.getByLabel("Notre décision").selectOption("chosen");
  await page.getByRole("button", { name: "Enregistrer mon choix" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter", exact: true }).click();
  const path = testInfo.outputPath("preparation.json");
  await (await download).saveAs(path);
  const parsed = JSON.parse(await readFile(path, "utf8"));
  expect(parsed.data.custom).toHaveLength(1);
  expect(parsed.data.custom[0].lat).toBe(9.95);
  const reading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Copie de lecture ↗" }).click();
  const html = testInfo.outputPath("lecture.html");
  await (await reading).saveAs(html);
  expect(await readFile(html, "utf8")).toContain("&lt;script&gt;");
  expect(await readFile(html, "utf8")).toContain("Programme proposé");
  expect(await readFile(html, "utf8")).toContain("Parrot Resort");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("un-soir-la-bas-upcoming-v1"),
    ),
  ).toBe("[]");
  await page.getByRole("button", { name: "Avant le départ" }).click();
  await page.getByLabel(/Vols et correspondances/).check();
  await page
    .getByLabel("Importer un fichier de préparation")
    .setInputFiles(path);
  await expect(page.getByRole("dialog")).toContainText("1 lieux personnels");
  const before = await page.evaluate((k) => localStorage.getItem(k), key);
  await page.getByRole("button", { name: "Fermer la fiche" }).click();
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(before);
  await page
    .getByLabel("Importer un fichier de préparation")
    .setInputFiles(path);
  const safety = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "1. Télécharger la copie actuelle" })
    .click();
  await safety;
  await page
    .getByRole("button", { name: "2. Remplacer par la préparation importée" })
    .click();
  expect(
    (await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key))
      .checks,
  ).toHaveLength(0);
});

test("un stockage corrompu ne peut pas être remplacé par un clic sur un favori", async ({
  page,
}) => {
  await page.evaluate((k) => localStorage.setItem(k, "{broken"), key);
  await page.reload();
  await openCatalogue(page);
  await expect(page.getByRole("alert")).toContainText("conservée intacte");
  await page
    .getByRole("button", {
      name: "Garder Pescadores Suites dans les favoris",
      exact: true,
    })
    .click();
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(
    "{broken",
  );
});

test("import invalide et paiement incohérent préservent la préparation", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Avant le départ" }).click();
  await page.getByLabel("Importer un fichier de préparation").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"format":"unsoirlabas-family","data":{}}'),
  });
  await expect(page.getByRole("status")).toContainText("invalide");
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBeNull();
  await page.getByRole("button", { name: "Explorer & choisir" }).click();
  await page
    .getByRole("heading", { name: "Pescadores Suites", exact: true })
    .click();
  await page
    .getByText("Prix, paiement et réservation", { exact: true })
    .click();
  await page.getByLabel(/Total du séjour/).fill("50");
  await page.getByLabel("Déjà payé pour quatre (€)").fill("100");
  await page.getByRole("button", { name: "Enregistrer mon choix" }).click();
  await expect(page.getByRole("alert")).toContainText("dépasser");
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBeNull();
});

for (const width of [390, 1440])
  test(`présentation ${width}px et navigation sans débordement`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const tab of [
      "Explorer & choisir",
      "Jour par jour",
      "Notre budget",
      "Avant le départ",
    ]) {
      await page.getByRole("button", { name: tab, exact: true }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
      ).toBeLessThanOrEqual(1);
    }
    await page.getByRole("button", { name: "Explorer & choisir" }).click();
    await page.screenshot({
      path: testInfo.outputPath(`family-${width}.png`),
      fullPage: true,
    });
    await page
      .getByRole("heading", { name: "Pescadores Suites", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

test("le planning illustré ouvre sur 21 journées dont trois nuits à Bohol", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Jour par jour" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".fp-day")).toHaveCount(21);
  await expect(page.locator(".fp-day-backup")).toHaveCount(21);
  await expect(page.locator(".fp-day-sequence dt")).toHaveCount(63);
  await expect(page.locator(".fp-day h3").first()).toBeInViewport();
  await expect(page.locator(".fp-program-photo img")).toHaveCount(6);
  const route = page.getByRole("navigation", { name: "Étapes du voyage" });
  for (const [place, nights] of [
    ["Moalboal", 3],
    ["Dauin", 5],
    ["Siquijor", 7],
    ["Bohol", 3],
    ["Mactan", 2],
  ] as const) {
    await expect(
      route.getByRole("button", { name: new RegExp(place) }),
    ).toContainText(nights + " nuits");
  }
  await route.getByRole("button", { name: /Moalboal/ }).click();
  await expect(page.locator(".fp-day")).toHaveCount(3);
  await expect(page.locator("#plan-2027-02-19")).toContainText("sardines");
  await route.getByRole("button", { name: /Mactan/ }).click();
  await expect(page.locator("#plan-2027-03-07")).toContainText("ferry");
  await expect(page.locator("#plan-2027-03-08")).toContainText("Alegre");
  await page
    .getByRole("navigation", { name: "Étapes du voyage" })
    .getByRole("button", { name: /Bohol/ })
    .click();
  await expect(page.locator(".fp-day")).toHaveCount(3);
  await expect(page.locator(".fp-sleep")).toHaveText([
    "Nuit à Panglao",
    "Nuit à Panglao",
    "Nuit à Panglao",
  ]);
  await page.getByLabel("Aller à une journée").selectOption("2027-03-06");
  await expect(page.locator("#plan-2027-03-06")).toBeFocused();
});

test("les dates et paiements de l’ancien circuit Bohol restent consultables et exportables", async ({
  page,
}, info) => {
  await page
    .getByRole("button", { name: "Garder Pescadores Suites dans les favoris" })
    .click();
  await page.evaluate((k) => {
    const data = JSON.parse(localStorage.getItem(k)!);
    data.custom.push({
      id: "custom-old",
      name: "Mon lodge de Loboc",
      stage: "loboc",
      kind: "hotel",
      description: "Ancien choix",
      family: "À quatre",
      caution: "À vérifier",
      lat: 9.63,
      lon: 124.03,
      source: "",
      verified: false,
      tags: [],
      duration: "3 nuits",
    });
    data.choices["custom-old"] = {
      ...data.choices.pescadores,
      date: "2027-03-02",
      status: "booked",
      cost: "400",
      paid: "100",
      notes: "Acompte versé",
    };
    localStorage.setItem(k, JSON.stringify(data));
  }, key);
  await page.reload();
  await page.getByRole("button", { name: /Mon lodge de Loboc ·/ }).click();
  await expect(page.getByLabel("Date d’arrivée envisagée")).toHaveValue(
    "2027-03-02",
  );
  await expect(
    page
      .getByRole("dialog")
      .getByRole("textbox", { name: "Nos notes", exact: true }),
  ).toHaveValue("Acompte versé");
  await page.getByRole("button", { name: "Fermer la fiche" }).click();
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter", exact: true }).click();
  const path = info.outputPath("planning.json");
  await (await event).saveAs(path);
  const saved = JSON.parse(await readFile(path, "utf8")).data;
  expect(saved.custom[0].stage).toBe("bohol");
  expect(saved.choices["custom-old"]).toMatchObject({
    date: "2027-03-02",
    status: "booked",
    paid: "100",
    cost: "400",
  });
});
