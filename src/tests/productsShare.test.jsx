import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Products from "../Products.jsx";

const data = {
  products: [
    { id: "p1", model: "iPhone 13", design: "Afro Queen", stock: 3, price: 5000 },
    { id: "p2", model: "iPhone 13", design: "Bogolan", stock: 0, price: 5000 },
    { id: "p3", model: "iPhone 14", design: "Ciwara", stock: 2, price: 5000 },
  ],
  settings: {
    models: ["iPhone 13", "iPhone 14"],
    designs: [
      { id: "D1", name: "Afro Queen", image: "https://example.com/a.jpg" },
      { id: "D2", name: "Bogolan", image: "https://example.com/b.jpg" },
      { id: "D3", name: "Ciwara", image: "https://example.com/c.jpg" },
    ],
  },
  sales: [], movements: [],
};

describe("Produits → Envoyer photos", () => {
  it("admin : le bouton ouvre l'outil, « ← Produits » revient à la liste", () => {
    render(<Products data={data} onSale={() => {}} onDelete={() => {}} />);
    expect(screen.getByText(/Produits \(3\)/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Envoyer photos/ }));
    expect(screen.getByText("Envoyer des photos au client")).toBeTruthy();
    expect(screen.queryByText(/Produits \(3\)/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /← Produits/ }));
    expect(screen.getByText(/Produits \(3\)/)).toBeTruthy();
  });

  it("n'affiche que les designs EN STOCK du modèle choisi, avec leur photo", () => {
    render(<Products data={data} onSale={() => {}} onDelete={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Envoyer photos/ }));
    fireEvent.change(screen.getByLabelText(/Modèle d'iPhone du client/), { target: { value: "iPhone 13" } });

    expect(screen.getByRole("button", { name: "Afro Queen" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Bogolan" })).toBeNull(); // rupture de stock
    expect(screen.queryByRole("button", { name: "Ciwara" })).toBeNull();  // autre modèle
  });

  it("partenaire (viewer) : pas de bouton d'envoi", () => {
    render(<Products data={data} onSale={() => {}} onDelete={() => {}} isViewer />);
    expect(screen.queryByRole("button", { name: /Envoyer photos/ })).toBeNull();
  });
});
