// src/hooks/useTableManager.js
import { useState, useEffect, useCallback } from "react";
import { loadData, saveData } from "../utils/storage";
import { validateRow, validateRows } from "../utils/validation";

function makeId() {
  return Date.now().toString() + "-" + Math.random().toString(16).slice(2);
}

function normalizeRow(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (!raw.id) return { ...raw, id: makeId() };
  return raw;
}

export function useTableManager(storageKey, validationType, defaultRow) {
  const [rows, setRows] = useState(() => {
    const stored = loadData(storageKey, []) || [];
    const normalized = stored.map(normalizeRow).filter((r) => r !== null);
    return normalized.length > 0 ? normalized : [defaultRow];
  });

  const [errorsByRow, setErrorsByRow] = useState({});
  const [formMessage, setFormMessage] = useState("");

  useEffect(() => {
    saveData(storageKey, rows);
  }, [rows, storageKey]);

  useEffect(() => {
    const { errorsByRow } = validateRows(validationType, rows);
    setErrorsByRow(errorsByRow);
  }, [rows, validationType]);

  const getError = useCallback(
    (rowId, field) =>
      errorsByRow[rowId] && errorsByRow[rowId][field]
        ? errorsByRow[rowId][field]
        : "",
    [errorsByRow]
  );

  const updateRowField = useCallback(
    (rowId, field, value) => {
      setRows((prev) => {
        const updated = prev.map((row) =>
          row.id === rowId ? { ...row, [field]: value } : row
        );

        const targetRow = updated.find((r) => r.id === rowId);
        const { errors } = validateRow(validationType, targetRow || {});
        setErrorsByRow((prevErrors) => ({
          ...prevErrors,
          [rowId]: errors,
        }));

        return updated;
      });
      setFormMessage("");
    },
    [validationType]
  );

  const addRow = useCallback(() => {
    const { isValid } = validateRows(validationType, rows);
    if (!isValid) {
      setFormMessage(
        "Please fix the highlighted fields before adding a new row."
      );
      return;
    }
    setRows((prev) => [...prev, { ...defaultRow, id: makeId() }]);
    setFormMessage("");
  }, [rows, validationType, defaultRow]);

  const deleteRow = useCallback((rowId) => {
    setRows((prev) => prev.filter((row) => row.id !== rowId));
    setErrorsByRow((prev) => {
      const copy = { ...prev };
      delete copy[rowId];
      return copy;
    });
    setFormMessage("");
  }, []);

  return { rows, formMessage, getError, updateRowField, addRow, deleteRow };
}