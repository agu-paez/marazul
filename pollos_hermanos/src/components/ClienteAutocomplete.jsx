import { useState, useRef, useEffect } from "react";

export default function ClienteAutocomplete({ value, onChange, clientes, onAddCliente, disabled = false, placeholder = "Seleccionar cliente" }) {
  const selected = clientes.find((cliente) => String(cliente.id) === String(value));
  const [inputValue, setInputValue] = useState(selected?.nombre || "");
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const selectingRef = useRef(false);

  useEffect(() => {
    const cliente = clientes.find((item) => String(item.id) === String(value));
    setInputValue(cliente?.nombre || "");
  }, [value, clientes]);

  const filtered = clientes.filter((cliente) =>
    cliente.nombre.toLowerCase().includes(inputValue.toLowerCase())
  );

  const selectCliente = (cliente) => {
    selectingRef.current = true;
    setInputValue(cliente.nombre);
    onChange(String(cliente.id));
    setShowDropdown(false);
    setHighlightedIndex(-1);
  };

  const handleInputChange = (event) => {
    setInputValue(event.target.value);
    skipSyncRef.current = true;
    onChange("");
    setShowDropdown(true);
    setHighlightedIndex(-1);
  };

  const handleFocus = () => setShowDropdown(true);

  const createIfNeeded = () => {
    const nombre = inputValue.trim();
    if (!nombre) return;
    const existente = clientes.find((cliente) => cliente.nombre.toLowerCase() === nombre.toLowerCase());
    if (existente) {
      selectCliente(existente);
    } else {
      onAddCliente(nombre);
      onChange("");
    }
    setShowDropdown(false);
    setHighlightedIndex(-1);
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (selectingRef.current) {
        selectingRef.current = false;
        return;
      }
      createIfNeeded();
    }, 200);
  };

  const handleKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!showDropdown) { setShowDropdown(true); return; }
      setHighlightedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!showDropdown) { setShowDropdown(true); return; }
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
        selectCliente(filtered[highlightedIndex]);
      } else {
        createIfNeeded();
      }
    } else if (event.key === "Escape") {
      setShowDropdown(false);
      setHighlightedIndex(-1);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowDropdown(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        required
        style={{ width: "100%" }}
      />
      {showDropdown && !disabled && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, maxHeight: "200px",
          overflowY: "auto", background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "4px", zIndex: 1000, marginTop: "2px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "6px 8px", color: "black", fontSize: "0.85rem", background: "#d4edda" }}>
              {inputValue.trim() ? `Se agregara "${inputValue.trim()}" como nuevo cliente` : "No hay clientes disponibles"}
            </div>
          ) : (
            filtered.map((cliente, index) => (
              <div
                key={cliente.id}
                onClick={() => selectCliente(cliente)}
                onMouseEnter={() => setHighlightedIndex(index)}
                style={{
                  padding: "6px 8px", cursor: "pointer", fontSize: "0.85rem",
                  background: index === highlightedIndex ? "var(--primary)" : "transparent",
                  color: index === highlightedIndex ? "white" : "var(--text)",
                }}
              >
                {cliente.nombre}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
