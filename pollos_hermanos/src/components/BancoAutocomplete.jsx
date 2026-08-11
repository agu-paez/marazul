import { useState, useRef, useEffect } from "react";

export default function BancoAutocomplete({ value, onChange, bancos, onAddBanco, exclude = [], placeholder = "Seleccionar banco", inputStyle = {} }) {
  const [inputValue, setInputValue] = useState(value || "");
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const selectingRef = useRef(false);

  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  const filtered = bancos.filter(
    (b) => !exclude.includes(b) && b.toLowerCase().includes(inputValue.toLowerCase())
  );

  const selectBanco = (banco) => {
    selectingRef.current = true;
    setInputValue(banco);
    onChange(banco);
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
      const v = inputValue.trim();
      if (v && v !== value) {
        if (!bancos.includes(v)) {
          onAddBanco(v);
        }
        onChange(v);
      } else if (!v && value) {
        onChange("");
      }
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
        selectBanco(filtered[highlightedIndex]);
      } else if (inputValue.trim()) {
        const v = inputValue.trim();
        if (!bancos.includes(v)) onAddBanco(v);
        onChange(v);
        setShowDropdown(false);
        setHighlightedIndex(-1);
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

  return (
    <div ref={containerRef} style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "0.6rem 0.75rem",
          fontSize: "1rem",
          minHeight: "42px",
          borderRadius: "4px",
          border: "1px solid var(--border)",
          background: "var(--bg-input)",
          color: "var(--text)",
          boxSizing: "border-box",
          outline: "none",
          ...inputStyle,
        }}
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
          {filtered.length === 0 ? (
            <div
              style={{
                padding: "6px 8px",
                color: "black",
                fontSize: "0.85rem",
                background: "#d4edda",
              }}
            >
              {inputValue.trim()
                ? `Agregar "${inputValue.trim()}" como nuevo banco`
                : "No hay bancos disponibles"}
            </div>
          ) : (
            filtered.map((b, i) => (
              <div
                key={b}
                onClick={() => selectBanco(b)}
                onMouseEnter={() => setHighlightedIndex(i)}
                style={{
                  padding: "6px 8px",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  background: i === highlightedIndex ? "var(--primary)" : "transparent",
                  color: i === highlightedIndex ? "white" : "var(--text)",
                }}
              >
                {b}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
