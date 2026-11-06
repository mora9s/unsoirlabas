import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { guide } from "../src/field-guide";
const dates = Array.from({length:21}, (_,i) => new Date(Date.UTC(2027,1,17+i)).toISOString().slice(0,10));

test("les 21 carnets terrain se parcourent sur mobile, sans alternative ni débordement", async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto("/#philippines");
  const buttons = page.getByRole("button", {name: "Ouvrir le déroulé du jour"});
  await expect(buttons).toHaveCount(dates.length);
  await buttons.first().click();
  for (const [i, date] of dates.entries()) {
    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveAccessibleName(await page.locator("#plan-"+date+" h3").first().innerText());
    await expect(dialog.getByRole("heading",{name:"Dans le sac"})).toBeVisible();
    await expect(dialog.locator(".field-line li")).toHaveCount(guide[date].stops.length);
    await expect(dialog).not.toContainText("Alternative du jour");
    expect(guide[date].stops.some(s => s[1] === "Repas")).toBe(true);
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth+1)).toBe(true);
    if (!i) await expect(dialog.getByRole("button",{name:"← Veille"})).toBeDisabled();
    if (i < dates.length - 1) await dialog.getByRole("button",{name:"Lendemain →"}).click();
  }
  await expect(page.getByRole("button",{name:"Lendemain →"})).toBeDisabled();
  await page.getByRole("button",{name:"← Veille"}).click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName("Une matinée de découverte à Mactan");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("au port, fiche privée téléchargeable hors ligne et navigation terrestre distincte du ferry", async ({page, context}) => {
  await page.goto("/#philippines");
  const btn = page.locator("#plan-2027-03-07").getByRole("button",{name:"Ouvrir le déroulé du jour"});
  await btn.click();
  const dialog = page.getByRole("dialog");
  const url = new URL((await dialog.getByRole("link",{name:/Itinéraire en voiture/}).getAttribute("href"))!);
  expect(url.pathname).toBe("/maps/dir/");
  expect(url.searchParams.get("destination")).toContain("Tagbilaran");
  expect(url.searchParams.get("travelmode")).toBe("driving");
  await expect(dialog.getByText("Ferry Tagbilaran → Cebu",{exact:true}).locator("..").getByRole("link")).toHaveCount(0);
  await context.setOffline(true);
  const downloading = page.waitForEvent("download");
  await dialog.getByRole("button",{name:/Enregistrer la fiche/}).click();
  const file = await downloading;
  expect(file.suggestedFilename()).toBe("jour-2027-03-07.txt");
  const txt = await readFile((await file.path())!, "utf8");
  expect(txt).toContain("aucun ferry");
  expect(txt).toContain("Tagbilaran");
  expect(txt).not.toContain("En cas d’avis de perturbation");
});
