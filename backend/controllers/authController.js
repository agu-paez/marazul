import jwt from "jsonwebtoken";
import { User, Role } from "../models/index.js";

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );
};

export const register = async (req, res) => {
  try {
    const { nombre, email, password, roleId } = req.body;

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: "El email ya está registrado" });
    }

    const role = roleId
      ? await Role.findByPk(roleId)
      : await Role.findOne({ where: { nombre: "operador" } });

    if (!role) {
      return res.status(400).json({ message: "Rol no válido" });
    }

    const user = await User.create({
      nombre,
      email,
      password,
      roleId: role.id,
    });

    const token = generateToken(user);

    res.status(201).json({
      message: "Usuario registrado exitosamente",
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        role: role.nombre,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Error al registrar usuario", error: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { nombre, password } = req.body;
    console.log("Login attempt:", nombre);

    const user = await User.findOne({
      where: { nombre },
      include: [{ model: Role, attributes: ["nombre"] }],
    });

    console.log("User found:", user ? "yes" : "no");

    if (!user) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    if (!user.activo) {
      return res.status(401).json({ message: "Usuario desactivado" });
    }

    const validPassword = await user.validPassword(password);
    console.log("Password valid:", validPassword);
    if (!validPassword) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    const token = generateToken(user);

    res.json({
      message: "Login exitoso",
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        role: user.Role?.nombre || "operador",
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Error al iniciar sesión", error: error.message });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: Role, attributes: ["nombre"] }],
      attributes: { exclude: ["password"] },
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener perfil", error: error.message });
  }
};

export const getLoginUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      where: { activo: true },
      include: [{ model: Role, attributes: ["nombre"] }],
      attributes: ["id", "nombre", "email"],
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener usuarios", error: error.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      include: [{ model: Role, attributes: ["nombre"] }],
      attributes: { exclude: ["password"] },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener usuarios", error: error.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, roleId, activo } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    await user.update({ nombre, email, roleId, activo });

    res.json({ message: "Usuario actualizado", user });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar usuario", error: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    await user.update({ activo: false });
    res.json({ message: "Usuario desactivado" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar usuario", error: error.message });
  }
};
