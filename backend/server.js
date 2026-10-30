const express = require("express");
const mysql = require("mysql2/promise");

function validProduct(body) {
  if (!body || typeof body.nombre !== "string" || !body.nombre.trim()) return false;
  if (body.nombre.trim().length > 100) return false;
  if (body.descripcion != null &&
      (typeof body.descripcion !== "string" || body.descripcion.length > 255)) return false;
  return typeof body.precio === "number" &&
    Number.isFinite(body.precio) && body.precio >= 0 && body.precio <= 99999999.99 &&
    Number.isInteger(body.stock) && body.stock >= 0 && body.stock <= 2147483647;
}

function validId(value) {
  return /^[1-9]\d*$/.test(value);
}

function createApp(pool) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());

  function fail(res, error, message) {
    console.error(error);
    return res.status(500).json({ message });
  }

  app.get("/api/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok" });
    } catch (_error) {
      res.status(503).json({ status: "unavailable" });
    }
  });

  app.get("/api/productos", async (_req, res) => {
    try {
      const [rows] = await pool.query("SELECT id, nombre, descripcion, precio, stock FROM productos ORDER BY id DESC");
      res.json(rows);
    } catch (error) {
      fail(res, error, "No se pudieron obtener los productos.");
    }
  });

  app.get("/api/productos/:id", async (req, res) => {
    if (!validId(req.params.id)) return res.status(400).json({ message: "ID inválido." });
    try {
      const [rows] = await pool.query("SELECT id, nombre, descripcion, precio, stock FROM productos WHERE id = ?", [req.params.id]);
      if (!rows.length) return res.status(404).json({ message: "Producto no encontrado." });
      res.json(rows[0]);
    } catch (error) {
      fail(res, error, "No se pudo obtener el producto.");
    }
  });

  app.post("/api/productos", async (req, res) => {
    if (!validProduct(req.body)) return res.status(400).json({ message: "Nombre, precio y stock válidos son obligatorios." });
    const { nombre, descripcion, precio, stock } = req.body;
    try {
      const [result] = await pool.query(
        "INSERT INTO productos (nombre, descripcion, precio, stock) VALUES (?, ?, ?, ?)",
        [nombre.trim(), descripcion || null, precio, stock]
      );
      const [rows] = await pool.query("SELECT id, nombre, descripcion, precio, stock FROM productos WHERE id = ?", [result.insertId]);
      res.status(201).json(rows[0]);
    } catch (error) {
      fail(res, error, "No se pudo crear el producto.");
    }
  });

  app.put("/api/productos/:id", async (req, res) => {
    if (!validId(req.params.id)) return res.status(400).json({ message: "ID inválido." });
    if (!validProduct(req.body)) return res.status(400).json({ message: "Nombre, precio y stock válidos son obligatorios." });
    const { nombre, descripcion, precio, stock } = req.body;
    try {
      const [result] = await pool.query(
        "UPDATE productos SET nombre = ?, descripcion = ?, precio = ?, stock = ? WHERE id = ?",
        [nombre.trim(), descripcion || null, precio, stock, req.params.id]
      );
      if (!result.affectedRows) return res.status(404).json({ message: "Producto no encontrado." });
      const [rows] = await pool.query("SELECT id, nombre, descripcion, precio, stock FROM productos WHERE id = ?", [req.params.id]);
      res.json(rows[0]);
    } catch (error) {
      fail(res, error, "No se pudo actualizar el producto.");
    }
  });

  app.delete("/api/productos/:id", async (req, res) => {
    if (!validId(req.params.id)) return res.status(400).json({ message: "ID inválido." });
    try {
      const [result] = await pool.query("DELETE FROM productos WHERE id = ?", [req.params.id]);
      if (!result.affectedRows) return res.status(404).json({ message: "Producto no encontrado." });
      res.json({ message: "Producto eliminado correctamente." });
    } catch (error) {
      fail(res, error, "No se pudo eliminar el producto.");
    }
  });

  return app;
}

function start() {
  const required = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error("Variables de base de datos faltantes: " + missing.join(", "));
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
  const port = Number(process.env.PORT || 3001);
  return createApp(pool).listen(port, () => console.log("Backend escuchando en puerto " + port));
}

if (require.main === module) start();
module.exports = { createApp, validProduct, validId };
