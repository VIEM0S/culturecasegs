import { useState, useMemo, useCallback } from "react";
import { toDateStr } from "./utils.js";

// ── Hook : pagination côté client des ventes ──────────────────────────────────
//
// Pourquoi côté client et pas Firestore ?
//   Toutes les ventes sont déjà chargées dans `data.sales` (via "main" Firestore).
//   Elles sont légères (pas d'images). La pagination côté client est donc instantanée
//   et ne coûte aucune lecture Firestore supplémentaire.
//   Si un jour les ventes dépassent ~5 000 entrées, basculer vers une requête
//   Firestore avec cursor (startAfter) — le hook exposera alors les mêmes props
//   sans changer les composants qui l'utilisent.
//
// Usage :
//   const { page, pages, items, goTo, next, prev, filters, setFilter } =
//     usePaginatedSales(data.sales, { pageSize: 30 });
//
export function usePaginatedSales(sales, { pageSize = 30 } = {}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFiltersRaw] = useState({
    search:   "",   // texte libre : client, téléphone, quartier
    dateFrom: "",   // YYYY-MM-DD
    dateTo:   "",   // YYYY-MM-DD
  });

  // Mettre à jour un filtre et revenir à la page 1
  const setFilter = useCallback((key, value) => {
    setFiltersRaw(f => ({ ...f, [key]: value }));
    setCurrentPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersRaw({ search: "", dateFrom: "", dateTo: "" });
    setCurrentPage(1);
  }, []);

  // Filtrage
  const filtered = useMemo(() => {
    const q = filters.search.toLowerCase().trim();
    return sales.filter(s => {
      if (q) {
        const hay = [s.client, s.phone, s.quartier].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.dateFrom && toDateStr(s.date) < filters.dateFrom) return false;
      if (filters.dateTo   && toDateStr(s.date) > filters.dateTo)   return false;
      return true;
    });
  }, [sales, filters]);

  // Tri : plus récentes en premier
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [filtered]
  );

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage   = Math.min(currentPage, totalPages);
  const items      = useMemo(
    () => sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sorted, safePage, pageSize]
  );

  const goTo = useCallback(p => setCurrentPage(Math.max(1, Math.min(p, totalPages))), [totalPages]);
  const next = useCallback(() => goTo(safePage + 1), [goTo, safePage]);
  const prev = useCallback(() => goTo(safePage - 1), [goTo, safePage]);

  return {
    // Données paginées
    items,
    // Pagination
    page:  safePage,
    pages: totalPages,
    total: filtered.length,
    goTo,
    next,
    prev,
    hasPrev: safePage > 1,
    hasNext: safePage < totalPages,
    // Filtres
    filters,
    setFilter,
    resetFilters,
  };
}
