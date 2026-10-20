import assert from "node:assert/strict";
import { test } from "node:test";
import { findNavLocation, isNavActive, visibleNav } from "./app-nav";

test("dashboard is active only on the organization root", () => {
  assert.equal(isNavActive("/acme", "/acme", ""), true);
  assert.equal(isNavActive("/acme/projects", "/acme", ""), false);
});

test("nested pages resolve to their navigation group", () => {
  const location = findNavLocation("/acme/procurement/bills/new", "/acme");
  assert.equal(location?.group.title, "Procurement");
  assert.equal(location?.link.title, "Vendor bills");
});

test("currency settings pages resolve to their own link, not Settings", () => {
  const location = findNavLocation("/acme/settings/exchange-rates", "/acme");
  assert.equal(location?.link.title, "Exchange rates");
  assert.equal(
    findNavLocation("/acme/settings/roles", "/acme")?.link.title,
    "Settings",
  );
});

test("permission-gated links are hidden without the permission", () => {
  const titles = (permissions: string[]) =>
    visibleNav(permissions).flatMap((group) => group.links.map((l) => l.title));
  assert.equal(titles([]).includes("Currencies"), false);
  assert.equal(titles(["currency.manage"]).includes("Currencies"), true);
  assert.equal(titles(["currency.manage"]).includes("Exchange rates"), false);
  assert.equal(
    titles(["exchangeRate.manage"]).includes("Exchange rates"),
    true,
  );
});

test("assets navigation is permission-gated and owns nested asset pages", () => {
  const titles = (permissions: string[]) =>
    visibleNav(permissions).flatMap((group) =>
      group.links.map((link) => link.title),
    );
  assert.equal(titles([]).includes("Assets"), false);
  assert.equal(titles(["asset.view"]).includes("Assets"), true);
  assert.equal(
    findNavLocation("/acme/assets/asset-1", "/acme")?.link.title,
    "Assets",
  );
});

test("journal creators see journals without gaining report navigation", () => {
  const links = (permissions: string[]) =>
    visibleNav(permissions).flatMap((group) => group.links);
  const journalOnly = links(["journal.create"]);
  assert.equal(
    journalOnly.some((link) => link.title === "Journals"),
    true,
  );
  assert.equal(
    journalOnly.some((link) => link.title === "Trial balance"),
    false,
  );
  assert.equal(
    journalOnly.some((link) => link.title === "Profit and loss"),
    false,
  );
  const accounting = links(["accounting.view"]);
  assert.equal(
    accounting.some((link) => link.title === "Journals"),
    true,
  );
  assert.equal(
    accounting.some((link) => link.title === "Balance sheet"),
    true,
  );
  assert.equal(
    links(["accounting.manage"]).some((link) => link.title === "Accounts"),
    true,
  );
});
