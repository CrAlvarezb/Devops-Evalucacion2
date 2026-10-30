/**
 * Frontend simple para CRUD de productos de la tienda de perritos.
 */

// Determinar la URL base de la API según el host
// frontend/app.js

const API_BASE = "/api/productos";

// Ejemplo: const API_BASE = "http://10.0.2.30:3001/api/productos";


let editandoId = null;

const tbody = document.getElementById("tbodyProductos");
const btnCargar = document.getElementById("btnCargar");
const btnGuardar = document.getElementById("btnGuardar");
const btnCancelar = document.getElementById("btnCancelar");
const btnTema = document.getElementById("btnTema");
const inputBuscar = document.getElementById("buscar");
const formTitle = document.getElementById("formTitle");
const statusDiv = document.getElementById("status");

let productos = [];

const inputNombre = document.getElementById("nombre");
const inputDescripcion = document.getElementById("descripcion");
const inputPrecio = document.getElementById("precio");
const inputStock = document.getElementById("stock");

function setStatus(mensaje, tipo = "ok") {
  statusDiv.textContent = mensaje;
  statusDiv.className = "status " + tipo;
}

// Modo oscuro con persistencia en localStorage
function aplicarTema(oscuro) {
  document.body.classList.toggle("dark", oscuro);
  btnTema.textContent = oscuro ? "Modo claro" : "Modo oscuro";
  localStorage.setItem("tienda-perritos-tema", oscuro ? "dark" : "light");
}

function inicializarTema() {
  const guardado = localStorage.getItem("tienda-perritos-tema");
  aplicarTema(guardado === "dark");
}

async function cargarProductos() {
  try {
    const res = await fetch(API_BASE);
    if (!res.ok) throw new Error("Error al cargar productos");
    const data = await res.json();
    productos = data;
    renderProductos();
    setStatus("Productos cargados correctamente.", "ok");
  } catch (err) {
    console.error(err);
    setStatus("No se pudieron cargar los productos. ¿Está el backend levantado?", "error");
  }
}

// Filtro en tiempo real por nombre o descripción
function filtrarProductos(filtro) {
  const termino = filtro.toLowerCase();
  return productos.filter(
    (p) => p.nombre.toLowerCase().includes(termino) || (p.descripcion || "").toLowerCase().includes(termino)
  );
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function renderProductos(filtro) {
  const visibles = filtro ? filtrarProductos(filtro) : productos;
  tbody.innerHTML = "";
  visibles.forEach((p) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${escapeHtml(p.id)}</td>
      <td>${escapeHtml(p.nombre)}</td>
      <td>${escapeHtml(p.descripcion)}</td>
      <td>$${Number(p.precio).toFixed(2)}</td>
      <td>${escapeHtml(p.stock)}</td>
      <td>
        <button data-id="${escapeHtml(p.id)}" class="btn-editar">Editar</button>
        <button data-id="${escapeHtml(p.id)}" class="btn-eliminar danger">Eliminar</button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  // Asignar eventos a los botones
  document.querySelectorAll(".btn-editar").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      editarProducto(id);
    });
  });

  document.querySelectorAll(".btn-eliminar").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      if (confirm("¿Seguro que deseas eliminar este producto?")) {
        eliminarProducto(id);
      }
    });
  });
}

function limpiarFormulario() {
  editandoId = null;
  formTitle.textContent = "Nuevo producto";
  inputNombre.value = "";
  inputDescripcion.value = "";
  inputPrecio.value = "";
  inputStock.value = "";
}

function obtenerDatosFormulario() {
  return {
    nombre: inputNombre.value.trim(),
    descripcion: inputDescripcion.value.trim(),
    precio: parseFloat(inputPrecio.value),
    stock: parseInt(inputStock.value, 10),
  };
}

function validarProducto(prod) {
  if (!prod.nombre) return "El nombre es obligatorio.";
  if (isNaN(prod.precio) || prod.precio < 0) return "El precio debe ser un número mayor o igual a 0.";
  if (isNaN(prod.stock) || prod.stock < 0) return "El stock debe ser un número mayor o igual a 0.";
  return null;
}

async function guardarProducto() {
  const producto = obtenerDatosFormulario();
  const error = validarProducto(producto);
  if (error) {
    setStatus(error, "error");
    return;
  }

  try {
    let res;
    if (editandoId) {
      // Actualizar
      res = await fetch(`${API_BASE}/${editandoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(producto),
      });
    } else {
      // Crear
      res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(producto),
      });
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Error al guardar el producto");
    }

    const fueEdicion = Boolean(editandoId);
    limpiarFormulario();
    await cargarProductos();
    setStatus(fueEdicion ? "Producto actualizado correctamente." : "Producto creado correctamente.", "ok");
  } catch (err) {
    console.error(err);
    setStatus("Ocurrió un error al guardar el producto.", "error");
  }
}

async function editarProducto(id) {
  try {
    const res = await fetch(`${API_BASE}/${id}`);
    if (!res.ok) throw new Error("No se pudo obtener el producto");
    const p = await res.json();
    editandoId = p.id;
    formTitle.textContent = `Editar producto #${p.id}`;
    inputNombre.value = p.nombre;
    inputDescripcion.value = p.descripcion || "";
    inputPrecio.value = p.precio;
    inputStock.value = p.stock;
    setStatus("Editando producto.", "ok");
  } catch (err) {
    console.error(err);
    setStatus("No se pudo cargar el producto para editarlo.", "error");
  }
}

async function eliminarProducto(id) {
  try {
    const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Error al eliminar producto");
    await cargarProductos();
    setStatus("Producto eliminado correctamente.", "ok");
  } catch (err) {
    console.error(err);
    setStatus("No se pudo eliminar el producto.", "error");
  }
}

// Eventos
btnCargar.addEventListener("click", cargarProductos);
btnGuardar.addEventListener("click", guardarProducto);
btnCancelar.addEventListener("click", () => {
  limpiarFormulario();
  setStatus("Edición cancelada.", "ok");
});
inputBuscar.addEventListener("input", (e) => renderProductos(e.target.value));
btnTema.addEventListener("click", () => {
  aplicarTema(!document.body.classList.contains("dark"));
});

// Cargar productos y tema al iniciar
inicializarTema();
cargarProductos();
