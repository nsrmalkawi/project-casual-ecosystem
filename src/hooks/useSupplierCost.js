// src/hooks/useSupplierCost.js
import { useEffect, useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_BASE || (typeof window !== "undefined" ? window.location.origin : "");

const apiUrl = (path) =>
  API_BASE ? `${API_BASE}${path}`.replace(/([^:]\/)\/+/g, "$1") : path;

export async function fetchSupplierCost({ category, brand, item }) {
  if (!category || !item) {
    throw new Error("Category and item are required");
  }
  const params = new URLSearchParams({ category, item });
  if (brand) params.append("brand", brand);

  const resp = await fetch(apiUrl(`/api/suppliers/cost?${params.toString()}`));
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Supplier cost lookup failed: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  return data.record || null;
}

export function useSupplierCost({ category, brand, item, enabled = true }) {
  const [state, setState] = useState({ loading: false, error: "", record: null });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!enabled || !category || !item) return;
      setState((s) => ({ ...s, loading: true, error: "" }));
      try {
        const record = await fetchSupplierCost({ category, brand, item });
        if (!cancelled) {
          setState({ loading: false, error: "", record });
        }
      } catch (err) {
        if (!cancelled) {
          setState({ loading: false, error: err.message, record: null });
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [category, brand, item, enabled]);

  return state;
}
