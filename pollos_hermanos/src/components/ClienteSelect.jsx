import { useState, useRef, useEffect } from "react";

export default function ClienteSelect({ value, onChange, clientes, placeholder = "Seleccionar cliente" }) {
  const [inputValue, setInputValue] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const selectingRef = useRef(false);

  useEffect(() => {
    if (value) {
      const c = clientes.find((cl) => cl.id === parseInt(value));
      setInputValue(c ? c.nombre : "");
    }
  }, [value, clientes]);

  const filtered = clientes.filter(
    (c) => c.nombre !== "Seleccionar cliente" && c.nombre.toLowerCase().includes(inputValue.toLowerCase())
  );

  const selectCliente = (c) => {
    selectingRef.current = true;
    setInputValue(c.nombre);
    onChange(String(c.id));
    setShowDropdown(false);
    setHighlightedIndex(-1);
  };

  const handleNuevo = () => {
    selectingRef.current = true;
    onChange("nuevo");
    setShowDropdown(false);
    setHighlightedIndex(-1);
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    setShowDropdown(true);
    setHighlightedIndex(-1);
  };

  const handleFocus = () => {
    setShowDropdown(true);
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (selectingRef.current) {
        selectingRef.current = false;
        return;
      }
      if (!value) setInputValue("");
      setShowDropdown(false);
      setHighlightedIndex(-1);
    }, 200);
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!showDropdown) { setShowDropdown(true); return; }
      setHighlightedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!showDropdown) { setShowDropdown(true); return; }
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
        selectCliente(filtered[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
      setHighlightedIndex(-1);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    fontSize: "0.95rem",
    borderRadius: "4px",
    border: "1px solid var(--border)",
    background: "var(--bg-input)",
    color: "var(--text)",
    boxSizing: "border-box",
    outline: "none",
  };

  const itemStyle = (i, isNuevo) => ({
    padding: "8px 12px",
    cursor: "pointer",
    fontSize: "0.9rem",
    background: isNuevo
      ? "var(--primary)"
      : i === highlightedIndex ? "var(--primary)" : "transparent",
    color: i === highlightedIndex || isNuevo ? "white" : "var(--text)",
  });

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        style={inputStyle}
      />
      {showDropdown && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            maxHeight: "200px",
            overflowY: "auto",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "4px",
            zIndex: 1000,
            marginTop: "2px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          }}
        >
          {filtered.length === 0 && (
            <div style={{ padding: "6px 8px", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
              No hay clientes que coincidan
            </div>
          )}
          {filtered.map((c, i) => (
            <div
              key={c.id}
              onClick={() => selectCliente(c)}
              onMouseEnter={() => setHighlightedIndex(i)}
              style={itemStyle(i, false)}
            >
              {c.nombre}
            </div>
          ))}
          <div
            onClick={handleNuevo}
            onMouseEnter={() => setHighlightedIndex(filtered.length)}
            style={itemStyle(filtered.length, true)}
          >
            + Nuevo Cliente
          </div>
        </div>
      )}
    </div>
  );
}
