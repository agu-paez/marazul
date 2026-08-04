import axios from "axios";

const API = axios.create({
  baseURL: "/api",
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
    if (error.response?.status === 401) {
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
  getAll: () => API.get("/proveedores"),
  getById: (id) => API.get(`/proveedores/${id}`),
  create: (data) => API.post("/proveedores", data),
  update: (id, data) => API.put(`/proveedores/${id}`, data),
  delete: (id) => API.delete(`/proveedores/${id}`),
};

export const marcasAPI = {
  getAll: () => API.get("/marcas"),
  getByProveedor: (proveedorId) => API.get(`/marcas/proveedor/${proveedorId}`),
  getById: (id) => API.get(`/marcas/${id}`),
  create: (data) => API.post("/marcas", data),
  update: (id, data) => API.put(`/marcas/${id}`, data),
  delete: (id) => API.delete(`/marcas/${id}`),
  descargarPDF: () => API.get("/marcas/pdf", { responseType: "blob" }),
};

export const productosAPI = {
  getAll: () => API.get("/productos"),
  getLowStock: () => API.get("/productos/low-stock"),
  create: (data) => API.post("/productos", data),
  update: (id, data) => API.put(`/productos/${id}`, data),
  delete: (id) => API.delete(`/productos/${id}`),
  actualizarPrecios: (data) => API.put("/productos/actualizar-precios", data),
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
  getAll: () => API.get("/salidas-camion"),
  getMisSalidas: () => API.get("/salidas-camion/mis-salidas"),
  getById: (id) => API.get(`/salidas-camion/${id}`),
  create: (data) => API.post("/salidas-camion", data),
  updateStatus: (id, data) => API.put(`/salidas-camion/${id}/status`, data),
  registrarRegreso: (id, data) => API.put(`/salidas-camion/${id}/regreso`, data),
  update: (id, data) => API.put(`/salidas-camion/${id}`, data),
  delete: (id) => API.delete(`/salidas-camion/${id}`),
  getStats: () => API.get("/salidas-camion/stats"),
  getCamionesActivos: () => API.get("/salidas-camion/activos"),
  getStockCamion: (id) => API.get(`/salidas-camion/${id}/stock`),
};

export const cierreCajaAPI = {
  getResumenHoy: () => API.get("/cierre-caja/resumen-hoy"),
  cerrar: () => API.post("/cierre-caja/cerrar"),
  getHistorial: () => API.get("/cierre-caja/historial"),
  getPagosHoy: (fecha) => API.get("/cierre-caja/pagos-hoy", { params: fecha ? { fecha } : {} }),
  getDetalleCierre: (fecha) => API.get("/cierre-caja/detalle-cierre", { params: fecha ? { fecha } : {} }),
};

export const ventasAPI = {
  getAll: (params) => API.get("/ventas", { params }),
  getById: (id) => API.get(`/ventas/${id}`),
  create: (data) => API.post("/ventas", data),
  delete: (id) => API.delete(`/ventas/${id}`),
  getStats: () => API.get("/ventas/stats"),
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
};

export const clientesAPI = {
  getAll: () => API.get("/clientes"),
  getById: (id) => API.get(`/clientes/${id}`),
  create: (data) => API.post("/clientes", data),
  update: (id, data) => API.put(`/clientes/${id}`, data),
  updateMontos: (id, data) => API.put(`/clientes/${id}/montos`, data),
  delete: (id) => API.delete(`/clientes/${id}`),
  getHistorialCC: (id) => API.get(`/clientes/${id}/historial-cc`),
  registrarPagoCC: (id, data) => API.post(`/clientes/${id}/pago-cc`, data),
};

export const bancosAPI = {
  getAll: () => API.get("/bancos"),
  create: (data) => API.post("/bancos", data),
  delete: (id) => API.delete(`/bancos/${id}`),
};

export const produccionAPI = {
  getEstadisticas: () => API.get("/produccion"),
  create: (data) => API.post("/produccion", data),
};

export default API;
