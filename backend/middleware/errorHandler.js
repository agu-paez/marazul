import logger from "../utils/logger.js";

export const sanitizeErrorResponses = (req, res, next) => {
  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  const json = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 500 && body && typeof body === "object") {
      const sanitized = { ...body };
      delete sanitized.error;
      delete sanitized.stack;
      return json(sanitized);
    }
    return json(body);
  };

  return next();
};

export const errorHandler = (error, req, res, next) => {
  logger.error("API request failed", {
    error: error.stack || error.message,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
  });

  if (res.headersSent) {
    return next(error);
  }

  const status = error.message === "Origen no permitido" ? 403 : error.statusCode || 500;
  const response = {
    message: status === 403 ? "Origen no permitido" : "Error interno del servidor",
  };

  if (process.env.NODE_ENV !== "production") {
    response.error = error.message;
  }

  return res.status(status).json(response);
};
