import { describe, it, expect } from "vitest";
import {
  sanitize,
  validateImageUrl,
  validateProductForm,
  validateSaleForm,
  validateMovementForm,
  fmtMoney,
  toDateStr,
  getProductImageUrl,
} from "../utils.js";

// ─────────────────────────────────────────────────────────────────────────────
// sanitize
// ─────────────────────────────────────────────────────────────────────────────
describe("sanitize", () => {
  it("trim les espaces", () => {
    expect(sanitize("  hello  ")).toBe("hello");
  });
  it("tronque à maxLen", () => {
    expect(sanitize("abcdef", 3)).toBe("abc");
  });
  it("retourne '' pour une valeur non-string", () => {
    expect(sanitize(null)).toBe("");
    expect(sanitize(42)).toBe("");
    expect(sanitize(undefined)).toBe("");
  });
  it("accepte une chaîne vide", () => {
    expect(sanitize("")).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateImageUrl
// ─────────────────────────────────────────────────────────────────────────────
describe("validateImageUrl", () => {
  it("accepte une URL https valide", () => {
    expect(validateImageUrl("https://res.cloudinary.com/img.jpg")).toBe(true);
  });
  it("rejette une URL http (non sécurisée)", () => {
    expect(validateImageUrl("http://example.com/img.jpg")).toBe(false);
  });
  it("rejette les anciens formats data:", () => {
    expect(validateImageUrl("data:image/png;base64,abc")).toBe(false);
  });
  it("rejette les anciens formats idb:", () => {
    expect(validateImageUrl("idb:abc123")).toBe(false);
  });
  it("accepte null / undefined (pas d'image = valide)", () => {
    expect(validateImageUrl(null)).toBe(true);
    expect(validateImageUrl("")).toBe(true);
    expect(validateImageUrl(undefined)).toBe(true);
  });
  it("rejette une chaîne aléatoire non-URL", () => {
    expect(validateImageUrl("pas une url")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// fmtMoney
// ─────────────────────────────────────────────────────────────────────────────
describe("fmtMoney", () => {
  it("formate un montant en FCFA", () => {
    const result = fmtMoney(5000);
    expect(result).toContain("5");
    expect(result).toContain("000");
    expect(result).toContain("FCFA");
  });
  it("retourne — pour null", () => {
    expect(fmtMoney(null)).toBe("—");
  });
  it("retourne — pour undefined", () => {
    expect(fmtMoney(undefined)).toBe("—");
  });
  it("accepte 0 et affiche 0 FCFA", () => {
    const result = fmtMoney(0);
    expect(result).toContain("0");
    expect(result).toContain("FCFA");
  });
  it("accepte une devise personnalisée", () => {
    expect(fmtMoney(1000, "EUR")).toContain("EUR");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// toDateStr
// ─────────────────────────────────────────────────────────────────────────────
describe("toDateStr", () => {
  it("extrait YYYY-MM-DD d'un ISO complet", () => {
    expect(toDateStr("2026-05-19T14:32:00.000Z")).toBe("2026-05-19");
  });
  it("retourne la date telle quelle si déjà courte", () => {
    expect(toDateStr("2026-05-19")).toBe("2026-05-19");
  });
  it("retourne '' pour une valeur vide", () => {
    expect(toDateStr("")).toBe("");
    expect(toDateStr(null)).toBe("");
    expect(toDateStr(undefined)).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateProductForm
// ─────────────────────────────────────────────────────────────────────────────
describe("validateProductForm", () => {
  const validForm = {
    model: "iPhone 12",
    designs: [{ name: "Afro Queen", image: "" }],
    stock: 10,
  };

  it("retourne {} pour un formulaire valide", () => {
    expect(validateProductForm(validForm)).toEqual({});
  });
  it("exige un modèle", () => {
    const errors = validateProductForm({ ...validForm, model: "" });
    expect(errors.model).toBeTruthy();
  });
  it("exige au moins un design", () => {
    const errors = validateProductForm({ ...validForm, designs: [] });
    expect(errors.designs).toBeTruthy();
  });
  it("refuse un stock négatif", () => {
    const errors = validateProductForm({ ...validForm, stock: -1 });
    expect(errors.stock).toBeTruthy();
  });
  it("accepte un stock à 0", () => {
    const errors = validateProductForm({ ...validForm, stock: 0 });
    expect(errors.stock).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateSaleForm
// ─────────────────────────────────────────────────────────────────────────────
describe("validateSaleForm", () => {
  const product = { id: "p1", stock: 5 };
  const validForm = { productId: "p1" };

  it("valide un formulaire correct", () => {
    expect(validateSaleForm(validForm, product, 2)).toEqual({});
  });
  it("exige un produit", () => {
    const errors = validateSaleForm({ productId: "" }, product, 2);
    expect(errors.productId).toBeTruthy();
  });
  it("exige une quantité ≥ 1", () => {
    const errors = validateSaleForm(validForm, product, 0);
    expect(errors.qty).toBeTruthy();
  });
  it("refuse une quantité supérieure au stock", () => {
    const errors = validateSaleForm(validForm, product, 10);
    expect(errors.qty).toBeTruthy();
  });
  it("accepte exactement le stock disponible", () => {
    const errors = validateSaleForm(validForm, product, 5);
    expect(errors.qty).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateMovementForm
// ─────────────────────────────────────────────────────────────────────────────
describe("validateMovementForm", () => {
  it("valide un mouvement correct", () => {
    const form = { lines: [{ productId: "p1", qty: 3 }] };
    expect(validateMovementForm(form)).toEqual({});
  });
  it("exige au moins une ligne", () => {
    expect(validateMovementForm({ lines: [] }).lines).toBeTruthy();
  });
  it("exige un produit sur chaque ligne", () => {
    const form = { lines: [{ productId: "", qty: 3 }] };
    expect(validateMovementForm(form).line_0_product).toBeTruthy();
  });
  it("exige une quantité ≥ 1 sur chaque ligne", () => {
    const form = { lines: [{ productId: "p1", qty: 0 }] };
    expect(validateMovementForm(form).line_0_qty).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getProductImageUrl
// ─────────────────────────────────────────────────────────────────────────────
describe("getProductImageUrl", () => {
  const designs = [
    { name: "Afro Queen", image: "https://res.cloudinary.com/afroqueen.jpg" },
    { name: "BLM", image: "" },
  ];

  it("retourne l'image du design depuis settings.designs", () => {
    const p = { design: "Afro Queen", designImage: "https://fallback.jpg" };
    expect(getProductImageUrl(p, designs)).toBe("https://res.cloudinary.com/afroqueen.jpg");
  });
  it("retourne le fallback designImage si le design n'a pas d'image", () => {
    const p = { design: "BLM", designImage: "https://fallback.jpg" };
    expect(getProductImageUrl(p, designs)).toBe("https://fallback.jpg");
  });
  it("retourne '' si le produit est null", () => {
    expect(getProductImageUrl(null, designs)).toBe("");
  });
  it("retourne '' si aucune image trouvée", () => {
    const p = { design: "Inexistant", designImage: "" };
    expect(getProductImageUrl(p, designs)).toBe("");
  });
});
