export const parseNumero = (valor) => {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  const texto = String(valor ?? "").trim().replace(/\s/g, "");
  if (!texto) return 0;
  const normalizado = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto.replace(/\.(?=\d{3}(?:\.|$))/g, "");
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : 0;
};

export const formatoNumero = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const dinero = (valor) => `$${formatoNumero.format(parseNumero(valor))}`;
