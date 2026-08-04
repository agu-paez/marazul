import { Router } from "express";
import { register, login, getProfile, getAllUsers, getLoginUsers, updateUser, deleteUser } from "../controllers/authController.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

router.post("/register", asyncHandler(register));
router.post("/login", asyncHandler(login));
router.get("/login-users", asyncHandler(getLoginUsers));
router.get("/profile", authenticate, asyncHandler(getProfile));
router.get("/users", authenticate, authorize("admin"), asyncHandler(getAllUsers));
router.put("/users/:id", authenticate, authorize("admin"), asyncHandler(updateUser));
router.delete("/users/:id", authenticate, authorize("admin"), asyncHandler(deleteUser));

export default router;
