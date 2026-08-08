import { User, Role } from "../models/index.js";
import { Op } from "sequelize";

export const getRepartidores = async (req, res) => {
  try {
    const roles = await Role.findAll();
    const roleMap = {};
    for (const r of roles) roleMap[r.nombre] = r.id;

    let where = { activo: true };

    if (req.userRole === "admin") {
      // admin can select any user
    } else if (req.userRole === "operador") {
      // operador can select repartidores and themselves
      where = {
        activo: true,
        [Op.or]: [
          { roleId: roleMap["repartidor"] },
          { id: req.user.id },
        ],
      };
    } else {
      // repartidor: only repartidores
      where.roleId = roleMap["repartidor"];
    }

    const users = await User.findAll({
      where,
      attributes: ["id", "nombre", "email"],
      order: [["nombre", "ASC"]],
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener repartidores", error: error.message });
  }
};

export const getUsuariosPago = async (req, res) => {
  try {
    const usuarios = await User.findAll({
      where: { activo: true },
      include: [{ model: Role, where: { nombre: ["repartidor", "operador"] }, attributes: ["nombre"] }],
      attributes: ["id", "nombre", "email"],
      order: [["nombre", "ASC"]],
    });
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener empleados", error: error.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      include: [{ model: Role, attributes: ["id", "nombre"] }],
      attributes: { exclude: ["password"] },
      order: [["createdAt", "DESC"]],
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener usuarios", error: error.message });
  }
};

export const getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      include: [{ model: Role, attributes: ["id", "nombre"] }],
      attributes: { exclude: ["password"] },
    });

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener usuario", error: error.message });
  }
};

export const createUser = async (req, res) => {
  try {
    const { nombre, email, password, roleId, activo } = req.body;

    if (!nombre || !password || !roleId) {
      return res.status(400).json({ message: "Nombre, password y rol son requeridos" });
    }

    const role = await Role.findByPk(roleId);
    if (!role) {
      return res.status(400).json({ message: "Rol no valido" });
    }

    const user = await User.create({
      nombre,
      email: email || `${nombre.toLowerCase().replace(/\s/g, '.')}@temp.local`,
      password,
      roleId: parseInt(roleId),
      activo: activo !== undefined ? activo : true,
    });

    const userSinPassword = await User.findByPk(user.id, {
      include: [{ model: Role, attributes: ["id", "nombre"] }],
      attributes: { exclude: ["password"] },
    });

    res.status(201).json({ message: "Usuario creado", user: userSinPassword });
  } catch (error) {
    res.status(500).json({ message: "Error al crear usuario", error: error.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const { nombre, email, roleId, activo } = req.body;

    if (email && email !== user.email) {
      const existing = await User.findOne({ where: { email } });
      if (existing) {
        return res.status(400).json({ message: "Ya existe un usuario con ese email" });
      }
    }

    await user.update({
      nombre: nombre || user.nombre,
      email: email || user.email,
      roleId: roleId != null ? roleId : user.roleId,
      activo: activo !== undefined ? activo : user.activo,
    });

    const userActualizado = await User.findByPk(user.id, {
      include: [{ model: Role, attributes: ["id", "nombre"] }],
      attributes: { exclude: ["password"] },
    });

    res.json({ message: "Usuario actualizado", user: userActualizado });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar usuario", error: error.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ message: "La contraseña debe tener al menos 6 caracteres" });
    }

    await user.update({ password });

    res.json({ message: "Contraseña restablecida exitosamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al restablecer contraseña", error: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    if (user.id === req.user.id) {
      return res.status(400).json({ message: "No puedes eliminar tu propia cuenta" });
    }

    await user.destroy();
    res.json({ message: "Usuario eliminado" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar usuario", error: error.message });
  }
};

export const getRoles = async (req, res) => {
  try {
    const roles = await Role.findAll();
    res.json(roles);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener roles", error: error.message });
  }
};
