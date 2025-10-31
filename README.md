# 🧠 Proyecto: Blog Fullstack con Cloudflare (Workers + D1 + Pages)

Este proyecto implementa un **mini blog fullstack serverless**, totalmente desplegado en Cloudflare.  
Utiliza **Cloudflare Workers** para el backend, **D1 (SQLite)** como base de datos, y **Cloudflare Pages** para el frontend estático.

---

## 🚀 Estructura general

```
/cloudflare-app
 ├── api/                   # Código backend (Cloudflare Worker)
 │    ├── index.ts          # Lógica principal del API REST
 │    └── wrangler.toml     # Configuración del Worker + D1
 ├── cloudflare-frontend/   # Frontend estático (HTML/JS)
 │    └── index.html
 └── README.md
```

---

## ☁️ Servicios usados en Cloudflare

Texto comparativo con equivalentes conocidos:

- **R2** → AWS S3 / Backblaze B2 → Almacenamiento de objetos (archivos, imágenes, backups)  
- **D1** → SQLite / Supabase / PlanetScale → Base de datos SQL ligera  
- **Workers** → AWS Lambda / Vercel Functions → Backend serverless (API)  
- **Pages** → GitHub Pages / Netlify → Hosting estático (frontend web)

---

## 🧩 Backend — Cloudflare Worker con D1

Archivo principal: `api/index.ts`

```typescript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 🔐 Permitir solo el frontend oficial
    const allowedOrigin = "https://650242fc.blog-frontend-5dr.pages.dev";
    const origin = request.headers.get("Origin");
    const corsHeaders = {
      "Access-Control-Allow-Origin": origin === allowedOrigin ? origin : "",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // 🧭 Manejar preflight (OPTIONS)
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      // 📚 GET /posts — Listar todos los posts
      if (url.pathname === "/posts" && request.method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT * FROM posts ORDER BY id DESC"
        ).all();

        return new Response(JSON.stringify(results), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // ✍️ POST /posts — Crear un nuevo post
      if (url.pathname === "/posts" && request.method === "POST") {
        const { title, content } = await request.json();
        const date = new Date().toISOString();

        await env.DB.prepare(
          "INSERT INTO posts (title, content, date) VALUES (?, ?, ?)"
        )
          .bind(title, content, date)
          .run();

        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // 🚫 Ruta desconocida
      return new Response("Not Found", { status: 404, headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  },
};
```

---

## ⚙️ Configuración del proyecto (wrangler.toml)

```toml
name = "blog-api"
main = "index.ts"
compatibility_date = "2024-10-30"

[[d1_databases]]
binding = "DB"
database_name = "blogdb"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

---

## 💾 Base de datos D1

```sql
CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  content TEXT,
  date TEXT
);
```

---

## 🌐 Frontend — Cloudflare Pages

Archivo principal: `cloudflare-frontend/index.html`

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Mi Blog en Cloudflare D1</title>
</head>
<body>
  <h1>Mi Blog en Cloudflare D1</h1>
  <form id="postForm">
    <input type="text" id="title" placeholder="Título" required />
    <textarea id="content" placeholder="Contenido" required></textarea>
    <button type="submit">Publicar</button>
  </form>
  <div id="posts"></div>

  <script>
    const API = "https://blog-api.ohuanca-lab.workers.dev/posts";

    async function cargarPosts() {
      const res = await fetch(API);
      const data = await res.json();
      document.getElementById("posts").innerHTML = data
        .map(p => \`<p><strong>\${p.title}</strong><br>\${p.content}<br><small>\${p.date}</small></p>\`)
        .join("");
    }

    document.getElementById("postForm").addEventListener("submit", async e => {
      e.preventDefault();
      await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: document.getElementById("title").value,
          content: document.getElementById("content").value
        })
      });
      e.target.reset();
      cargarPosts();
    });

    cargarPosts();
  </script>
</body>
</html>
```

---

## 🧪 Pruebas realizadas

### ✅ Verificación CORS
```bash
curl -X OPTIONS -i https://blog-api.ohuanca-lab.workers.dev/posts   -H "Origin: https://650242fc.blog-frontend-5dr.pages.dev"
```
**Resultado esperado:**  
HTTP/2 204 + encabezados CORS correctos.

### ✅ Publicar un post
Formulario en frontend → se inserta en D1.

### ✅ Listar posts
El frontend muestra los posts en orden descendente (más recientes primero).

---

## 🏁 Resultado final

- Backend: `https://blog-api.ohuanca-lab.workers.dev`
- Frontend: `https://650242fc.blog-frontend-5dr.pages.dev`
