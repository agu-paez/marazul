import jwt from "jsonwebtoken";
import { User, Role } from "../models/index.js";

export const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Token no proporcionado" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id, {
      include: [{ model: Role, attributes: ["nombre"] }],
    });

    if (!user || !user.activo) {
      return res.status(401).json({ message: "Usuario no válido" });
    }

    req.user = user;
    req.userRole = user.Role?.nombre || "operador";
    next();
  } catch {
    return res.status(401).json({ message: "Token inválido" });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ message: "No tienes permisos para esta acción" });
    }
    next();
  };
};
