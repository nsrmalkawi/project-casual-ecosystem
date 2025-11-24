import { createContext, useContext, useEffect, useState } from "react";
const DataContext = createContext();

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
  const [logo, setLogo] = useState(null);
  const [brandFilter, setBrandFilter] = useState("");
  const [outletFilter, setOutletFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Load initial data from localStorage when the app starts
  useEffect(() => {
    const savedLogo = localStorage.getItem("pc_app_logo");
    if (savedLogo) {
      setLogo(savedLogo);
    }
    const savedFilters = localStorage.getItem("pc_global_filters_v1");
    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters);
        setBrandFilter(parsed.brandFilter || "");
        setOutletFilter(parsed.outletFilter || "");
        setStartDate(parsed.startDate || "");
        setEndDate(parsed.endDate || "");
      } catch {
        // ignore
      }
    }
  }, []);

  // Persist filters
  useEffect(() => {
    const payload = {
      brandFilter,
      outletFilter,
      startDate,
      endDate,
    };
    localStorage.setItem("pc_global_filters_v1", JSON.stringify(payload));
  }, [brandFilter, outletFilter, startDate, endDate]);

  // Function to update the logo, save it to localStorage, and update the state
  const updateLogo = (newLogoData) => {
    try {
      localStorage.setItem("pc_app_logo", newLogoData);
      setLogo(newLogoData);
      return { success: true };
    } catch (e) {
      console.error("Failed to save logo:", e);
      return { success: false, error: e.message };
    }
  };

  const value = {
    logo,
    updateLogo,
    brandFilter,
    setBrandFilter,
    outletFilter,
    setOutletFilter,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
