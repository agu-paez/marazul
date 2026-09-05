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

export const formatearNumeroInput = (valor) => {
  if (valor === "" || valor === null || valor === undefined) return "";
  return formatoNumero.format(parseNumero(valor));
};

export const formatearNumeroMientrasEscribe = (valor) => {
  const texto = String(valor ?? "").replace(/[^0-9,.]/g, "");
  if (!texto) return "";
  const [enteroInicial, decimal] = texto.split(",");
  const entero = (enteroInicial || "0").replace(/\./g, "").replace(/^0+(?=\d)/, "");
  const enteroFormateado = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimal === undefined ? enteroFormateado : `${enteroFormateado},${decimal.slice(0, 2)}`;
};
