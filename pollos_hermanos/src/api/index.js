import axios from "axios";

const API = axios.create({
  baseURL: "/api",
});

const GET_CACHE_TTL = 60_000;
const getCache = new Map();
const pendingGets = new Map();
let cacheGeneration = 0;

const stableSerialize = (value) => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
};

const getCacheKey = (url, config = {}) => {
  const token = localStorage.getItem("token") || "public";
  return `${token}:${url}:${stableSerialize(config.params || {})}`;
};

const isCacheableGet = (config = {}) => config.responseType !== "blob" && !config.url?.toLowerCase().endsWith("/pdf");

const clearGetCache = () => {
  cacheGeneration += 1;
  getCache.clear();
};

const originalGet = API.get.bind(API);
API.get = (url, config = {}) => {
  if (!isCacheableGet({ ...config, url })) return originalGet(url, config);

  const key = getCacheKey(url, config);
  const cached = getCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.response);
  if (cached) getCache.delete(key);
  if (pendingGets.has(key)) return pendingGets.get(key);

  const requestGeneration = cacheGeneration;
  const request = originalGet(url, config).then((response) => {
    if (requestGeneration === cacheGeneration) {
      getCache.set(key, { response, expiresAt: Date.now() + GET_CACHE_TTL });
    }
    return response;
  }).finally(() => pendingGets.delete(key));
  pendingGets.set(key, request);
  return request;
};

["post", "put", "patch", "delete"].forEach((method) => {
  const original = API[method].bind(API);
  API[method] = (...args) => original(...args).then((response) => {
    clearGetCache();
    return response;
  });
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.url?.endsWith("/auth/login");
    if (error.response?.status === 401 && !isLoginRequest) {
      clearGetCache();
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (data) => API.post("/auth/login", data),
  register: (data) => API.post("/auth/register", data),
  getProfile: () => API.get("/auth/profile"),
  getLoginUsers: () => API.get("/auth/login-users"),
};

export const proveedoresAPI = {
  getAll: (params) => API.get("/proveedores", { params }),
  getById: (id) => API.get(`/proveedores/${id}`),
  create: (data) => API.post("/proveedores", data),
  update: (id, data) => API.put(`/proveedores/${id}`, data),
  delete: (id) => API.delete(`/proveedores/${id}`),
  registrarMovimiento: (id, data) => API.post(`/proveedores/${id}/movimientos`, data),
  cambiarEstado: (id) => API.patch(`/proveedores/${id}/estado`),
};

export const marcasAPI = {
  getAll: () => API.get("/marcas"),
  getByProveedor: (proveedorId) => API.get(`/marcas/proveedor/${proveedorId}`),
  getById: (id) => API.get(`/marcas/${id}`),
  create: (data) => API.post("/marcas", data),
  update: (id, data) => API.put(`/marcas/${id}`, data),
  delete: (id) => API.delete(`/marcas/${id}`),
  descargarPDF: (params) => API.get("/marcas/pdf", { params, responseType: "blob" }),
};

export const productosAPI = {
  getAll: () => API.get("/productos"),
  getLowStock: () => API.get("/productos/low-stock"),
  create: (data) => API.post("/productos", data),
  update: (id, data) => API.put(`/productos/${id}`, data),
  delete: (id) => API.delete(`/productos/${id}`),
  descontarStock: (id, data) => API.post(`/productos/${id}/descontar-stock`, data),
  actualizarPrecios: (data) => API.put("/productos/actualizar-precios", data),
  actualizarDescuentos: (data) => API.put("/productos/actualizar-descuentos", data),
};

export const repartosAPI = {
  getToday: () => API.get("/repartos/hoy"),
  getAll: () => API.get("/repartos"),
  getById: (id) => API.get(`/repartos/${id}`),
  create: (data) => API.post("/repartos", data),
  update: (id, data) => API.put(`/repartos/${id}`, data),
  delete: (id) => API.delete(`/repartos/${id}`),
  getStats: () => API.get("/repartos/stats"),
};

export const salidasAPI = {
  getAll: (params) => API.get("/salidas-camion", { params }),
  getMisSalidas: (params) => API.get("/salidas-camion/mis-salidas", { params }),
  getById: (id) => API.get(`/salidas-camion/${id}`),
  create: (data) => API.post("/salidas-camion", data),
  updateStatus: (id, data) => API.put(`/salidas-camion/${id}/status`, data),
  reabrir: (id) => API.put(`/salidas-camion/${id}/reabrir`),
  registrarRegreso: (id, data) => API.put(`/salidas-camion/${id}/regreso`, data),
  update: (id, data) => API.put(`/salidas-camion/${id}`, data),
  delete: (id) => API.delete(`/salidas-camion/${id}`),
  getStats: () => API.get("/salidas-camion/stats"),
  getCamionesActivos: () => API.get("/salidas-camion/activos"),
  getStockCamion: (id) => API.get(`/salidas-camion/${id}/stock`),
  getVentas: (id) => API.get(`/salidas-camion/${id}/ventas`),
  guardarConteo: (id, data) => API.put(`/salidas-camion/${id}/conteo`, data),
};

export const cierreCajaAPI = {
  getResumenHoy: (fecha) => API.get("/cierre-caja/resumen-hoy", { params: fecha ? { fecha } : {} }),
  cerrar: (fecha) => API.post("/cierre-caja/cerrar", fecha ? { fecha } : {}),
  abrir: (fecha) => API.post(`/cierre-caja/${fecha}/abrir`),
  eliminar: (fecha) => API.delete(`/cierre-caja/${fecha}`),
  getHistorial: () => API.get("/cierre-caja/historial"),
  getPagosHoy: (fecha) => API.get("/cierre-caja/pagos-hoy", { params: fecha ? { fecha } : {} }),
  getDetalleCierre: (fecha) => API.get("/cierre-caja/detalle-cierre", { params: fecha ? { fecha } : {} }),
  getHistorialGastos: () => API.get("/cierre-caja/historial-gastos"),
  getHistorialPagosEmpleados: () => API.get("/cierre-caja/historial-pagos-empleados"),
  getIngresosEgresos: (params) => API.get("/cierre-caja/ingresos-egresos", { params }),
};

export const ventasAPI = {
  getAll: (params) => API.get("/ventas", { params }),
  getById: (id) => API.get(`/ventas/${id}`),
  create: (data) => API.post("/ventas", data),
  delete: (id) => API.delete(`/ventas/${id}`),
  modificarPago: (id, data) => API.put(`/ventas/${id}/pago`, data),
  modificarProductos: (id, data) => API.put(`/ventas/${id}/productos`, data),
  getStats: (fecha) => API.get("/ventas/stats", { params: fecha ? { fecha } : {} }),
};

export const usuariosAPI = {
  getAll: () => API.get("/usuarios"),
  getById: (id) => API.get(`/usuarios/${id}`),
  create: (data) => API.post("/usuarios", data),
  update: (id, data) => API.put(`/usuarios/${id}`, data),
  resetPassword: (id, data) => API.put(`/usuarios/${id}/reset-password`, data),
  delete: (id) => API.delete(`/usuarios/${id}`),
  getRoles: () => API.get("/usuarios/roles"),
  getRepartidores: () => API.get("/usuarios/repartidores"),
  getEmpleadosPago: () => API.get("/usuarios/empleados-pago"),
};

export const gastosAPI = {
  getHoy: () => API.get("/gastos-dia/hoy"),
  guardar: (data) => API.put("/gastos-dia/hoy", data),
};

export const pagosEmpleadosAPI = {
  getHoy: () => API.get("/pagos-empleados/hoy"),
  guardar: (pagos) => API.put("/pagos-empleados/hoy", { pagos }),
};

export const clientesAPI = {
  getAll: () => API.get("/clientes"),
  getById: (id) => API.get(`/clientes/${id}`),
  create: (data) => API.post("/clientes", data),
  update: (id, data) => API.put(`/clientes/${id}`, data),
  updateMontos: (id, data) => API.put(`/clientes/${id}/montos`, data),
  revisar: (id) => API.put(`/clientes/${id}/revisar`),
  delete: (id) => API.delete(`/clientes/${id}`),
  getHistorialCC: (id) => API.get(`/clientes/${id}/historial-cc`),
  getHistorialDeudas: () => API.get("/clientes/historial-deudas"),
  registrarPagoCC: (id, data) => API.post(`/clientes/${id}/pago-cc`, data),
  eliminarPagoCC: (clienteId, pagoId) => API.delete(`/clientes/${clienteId}/pago-cc/${pagoId}`),
};

export const bancosAPI = {
  getAll: () => API.get("/bancos"),
  create: (data) => API.post("/bancos", data),
  delete: (id) => API.delete(`/bancos/${id}`),
};

export const produccionAPI = {
  getEstadisticas: () => API.get("/produccion"),
  getHistorial: () => API.get("/produccion/historial"),
  descargarHistorialPDF: (semana) => API.get(`/produccion/historial/${semana}/pdf`, { responseType: "blob" }),
  create: (data) => API.post("/produccion", data),
};

export default API;
