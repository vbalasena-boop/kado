// Prérequis : BEEPER_PILOT_SLUG côté serveur, commerce de test et session
// propriétaire exportée dans E2E_MERCHANT_STORAGE_STATE. Jamais de base réelle.
import { test, expect } from "@playwright/test";

test("scan → numéro → prête côté client → récupérée", async ({ browser }) => {
  const slug = process.env.BEEPER_PILOT_SLUG;
  const storageState = process.env.E2E_MERCHANT_STORAGE_STATE;
  expect(slug, "Configurer BEEPER_PILOT_SLUG").toBeTruthy();
  expect(storageState, "Configurer une session commerçant propriétaire").toBeTruthy();
  const baseURL = process.env.E2E_BASE_URL || "http://localhost:3100";
  const customer = await browser.newContext({ baseURL });
  const merchant = await browser.newContext({ baseURL, storageState });
  try {
    const page = await customer.newPage();
    const board = await merchant.newPage();
    await board.goto("/dashboard/beeper");
    const qrLink = board.getByRole("link", { name: new RegExp(`/b/${slug}$`) });
    await expect(qrLink).toBeVisible();
    // L'ouverture de l'URL encodée dans le QR reproduit le scan.
    await page.goto(await qrLink.getAttribute("href"));
    await expect(page.getByRole("heading", { name: "En préparation" })).toBeVisible();
    const number = await page.locator("strong").textContent();
    await page.reload();
    await expect(page.locator("strong")).toHaveText(number);
    const row = board.locator("div").filter({ has: board.getByText(number, { exact: true }) }).last();
    await row.getByRole("button", { name: "Prête", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Prête", exact: true })).toBeVisible({ timeout: 15000 });
    await row.getByRole("button", { name: "Récupérée" }).click();
    await expect(page.getByRole("heading", { name: "Récupérée" })).toBeVisible({ timeout: 15000 });
  } finally { await customer.close(); await merchant.close(); }
});
