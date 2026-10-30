const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createApp, validProduct, validId } = require("./server");

function serve(pool) {
  const server = createApp(pool).listen(0);
  return {
    base: "http://127.0.0.1:" + server.address().port,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test("valida entradas críticas", () => {
  assert.equal(validProduct({ nombre: "Comida", precio: 0, stock: 0 }), true);
  for (const price of [-1, "abc", "", Infinity, null, 100000000]) {
    assert.equal(validProduct({ nombre: "Comida", precio: price, stock: 2 }), false);
  }
  assert.equal(validProduct({ nombre: "Comida", precio: 10, stock: 1.5 }), false);
  assert.equal(validProduct({ nombre: "Comida", precio: 10, stock: 2147483648 }), false);
  assert.equal(validProduct({ nombre: " ", precio: 10, stock: 1 }), false);
  assert.equal(validId("1"), true);
  assert.equal(validId("0"), false);
  assert.equal(validId("1 OR 1=1"), false);
});

test("CRUD usa consultas parametrizadas y códigos correctos", async () => {
  const calls = [];
  const pool = { async query(sql, params = []) {
    calls.push({ sql, params });
    if (sql.startsWith("INSERT")) return [{ insertId: 7 }];
    if (sql.startsWith("UPDATE") || sql.startsWith("DELETE")) return [{ affectedRows: 1 }];
    return [[{ id: 7, nombre: "Comida", precio: 10, stock: 2 }]];
  }};
  const app = serve(pool);
  try {
    let response = await fetch(app.base + "/api/productos");
    assert.equal(response.status, 200);
    assert.equal((await response.json()).length, 1);
    response = await fetch(app.base + "/api/productos", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ nombre: " Comida ", precio: 10, stock: 2 }),
    });
    assert.equal(response.status, 201);
    assert.deepEqual(calls.find((c) => c.sql.startsWith("INSERT")).params, ["Comida", null, 10, 2]);
    response = await fetch(app.base + "/api/productos/7", {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ nombre: "Comida", precio: 10, stock: 2 }),
    });
    assert.equal(response.status, 200);
    assert.equal((await fetch(app.base + "/api/productos/7")).status, 200);
    assert.equal((await fetch(app.base + "/api/productos/7", { method: "DELETE" })).status, 200);
    assert.deepEqual(calls.find((c) => c.sql.startsWith("DELETE")).params, ["7"]);
  } finally { await app.close(); }
});

test("rechaza entradas inválidas y productos inexistentes", async () => {
  const pool = { async query(sql) {
    if (sql.startsWith("UPDATE") || sql.startsWith("DELETE")) return [{ affectedRows: 0 }];
    return [[]];
  }};
  const app = serve(pool);
  try {
    assert.equal((await fetch(app.base + "/api/productos/0")).status, 400);
    assert.equal((await fetch(app.base + "/api/productos/1")).status, 404);
    assert.equal((await fetch(app.base + "/api/productos/1", { method: "DELETE" })).status, 404);
    const response = await fetch(app.base + "/api/productos", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ nombre: "Comida", precio: -1, stock: 1 }),
    });
    assert.equal(response.status, 400);
  } finally { await app.close(); }
});

test("salud comprueba la base de datos", async () => {
  const healthy = serve({ query: async () => [[{ 1: 1 }]] });
  const unhealthy = serve({ query: async () => { throw new Error("DB unavailable"); } });
  try {
    assert.equal((await fetch(healthy.base + "/api/health")).status, 200);
    assert.equal((await fetch(unhealthy.base + "/api/health")).status, 503);
  } finally { await healthy.close(); await unhealthy.close(); }
});
