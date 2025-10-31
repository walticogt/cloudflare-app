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
// index.ts
export interface Env {
  DB: D1Database; // Tipo para la base de datos D1
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    //  CORS restringido a tu frontend
    const allowedOrigin = "https://650242fc.blog-frontend-5dr.pages.dev";

    const origin = request.headers.get("Origin");
    const corsHeaders = {
      "Access-Control-Allow-Origin":
        origin === allowedOrigin ? allowedOrigin : "",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    //  Manejo de preflight (OPTIONS)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    try {
      //  GET /posts  listar publicaciones
      if (url.pathname === "/posts" && request.method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT * FROM posts ORDER BY id DESC"
        ).all();

        return new Response(JSON.stringify(results), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      //  POST /posts  agregar publicacin
      if (url.pathname === "/posts" && request.method === "POST") {
        const { title, content }: { title: string; content: string } =
          await request.json();
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

      //  Ruta desconocida
      return new Response("Not Found", {
        status: 404,
        headers: corsHeaders,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      return new Response(JSON.stringify({ error: message }), {
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
main = "api/index.ts"
compatibility_date = "2025-10-30"

[[d1_databases]]
binding = "DB"
database_name = "blogdb"
database_id = "XXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
```
Cambiar el ID, por "wrangler d1 create blogdb"


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
Ejecuta:

wrangler d1 execute blogdb --remote --command="CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT, content TEXT, date TEXT);"

Comprueba:

wrangler d1 execute blogdb --remote --command="SELECT name FROM sqlite_master WHERE type='table';"


---

## 🌐 Frontend — Cloudflare Pages

Archivo principal: `cloudflare-frontend/index.html`

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Blog Cloudflare D1</title>
  <style>
    body { font-family: sans-serif; max-width: 600px; margin: 40px auto; }
    h1 { color: #f38020; }
    form { margin-bottom: 20px; }
    input, textarea { width: 100%; margin-bottom: 10px; padding: 8px; }
    button { background: #f38020; color: white; padding: 10px; border: none; cursor: pointer; }
    button:hover { background: #d96f1b; }
    .post { border-bottom: 1px solid #ccc; margin-bottom: 10px; padding-bottom: 10px; }
  </style>
</head>
<body>
  <h1>Mi Blog en Cloudflare D1</h1>
  <form id="postForm">
    <input type="text" id="title" placeholder="Ttulo" required />
    <textarea id="content" placeholder="Contenido" required></textarea>
    <button type="submit">Publicar</button>
  </form>

  <div id="posts"></div>

  <script>
    const API_URL = "https://blog-api.ohuanca-lab.workers.dev/posts";

    async function loadPosts() {
      const res = await fetch(API_URL);
      const posts = await res.json();
      const container = document.getElementById("posts");
      container.innerHTML = posts.map(p => `
        <div class="post">
          <h3>${p.title}</h3>
          <p>${p.content}</p>
          <small>${p.date}</small>
        </div>
      `).join("");
    }

    document.getElementById("postForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = document.getElementById("title").value;
      const content = document.getElementById("content").value;
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content })
      });
      e.target.reset();
      loadPosts();
    });

    loadPosts();
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

----
🚀 Objetivo del mini proyecto

Crearemos una mini app tipo blog o dashboard, con:
Frontend estático (HTML/JS/CSS) → alojado en Cloudflare Pages
Backend serverless (API) → en Cloudflare Workers
Base de datos SQL → con Cloudflare D1

Almacenamiento de archivos → con Cloudflare R2 (para subir imágenes o backups)
🧩 Estructura general

🧱 Paso 1. Crear cuenta Cloudflare

Entra en 👉 https://dash.cloudflare.com/sign-up
Crea una cuenta gratuita.
(Opcional) Compra o transfiere tu dominio al registrar Cloudflare Registrar (~10 USD/año).

⚙️ Paso 2. Instalar la CLI Wrangler
Wrangler es la herramienta oficial para desplegar Workers y D1.

npm install -g wrangler

Luego verifica:
wrangler --version

Y autentícate:
wrangler login

🗃️ Paso 3. Crear la base de datos D1
wrangler d1 create blogdb

Esto crea una base D1 llamada blogdb.
Cloudflare te mostrará el ID de la base (por ejemplo xxxxxxxx-xxxx-xxxx).

Puedes crear tablas luego con:

wrangler d1 execute blogdb --command="CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT, content TEXT, date TEXT);"

🧠 Paso 4. Crear un Worker (backend API)
Ejemplo de API que devuelve y guarda posts:

api/index.js

api/wrangler.toml

Despliegas tu API con:

wrangler deploy


Te dará una URL tipo:

https://blog-api.tu-nombre.workers.dev/posts

🌐 Paso 5. Crear el frontend (Cloudflare Pages)

frontend/index.html:

🗂️ Paso 6. (Opcional) Usar R2 para archivos

Crea un bucket R2:

wrangler r2 bucket create blogfiles


Y puedes subir archivos desde código:

const objectName = "imagen.jpg";
await env.BUCKET.put(objectName, await request.arrayBuffer());


En tu wrangler.toml:

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "blogfiles"

🧩 Resultado final

Frontend → https://tu-proyecto.pages.dev

Backend API → https://blog-api.tu-nombre.workers.dev/posts

Base SQL → D1 (blogdb)

Archivos → R2 (blogfiles)

Todo sin servidor, sin puertos, y con costos casi cero:

Servicio	Costo
Cloudflare Pages	Gratis
Cloudflare D1	Gratis (hasta millones de consultas)
Cloudflare R2	Gratis hasta 10 GB (según plan free)
Cloudflare Worker	Gratis (hasta 100k solicitudes/día)

## Resumen comandos 
```typescript
PASO 1: Crear cuenta
https://dash.cloudflare.com/sign-up

PASO 2: Instalacion
npm install -g wrangler
wrangler --version
wrangler login

PASO 3: BD
wrangler d1 create blogdb
wrangler d1 execute blogdb --remote --command="CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT, content TEXT, date TEXT);"
wrangler d1 execute blogdb --remote --command="SELECT name FROM sqlite_master WHERE type='table';"

PASO 4: Worker (API: .ts y wrangler.toml)
-- crear archivo api/index.ts y wrangler.toml
wrangler deploy

-- otros comandos antes del deploy:
wrangler dev
curl -X POST "http://127.0.0.1:8787/posts" \
     -H "Content-Type: application/json" \
     -d '{"title": "Primer Post", "content": "Hola desde Cloudflare D1"}'
curl http://127.0.0.1:8787/posts

PASO 5: Page (HTML)
--- crear carpeta /frontend .html
npx serve
wrangler pages deploy . --project-name=blog-frontend
-- confirmar Y, confirmar nombre
-- si no tienes problemas con los CORS, todo esta ya en nube.
curl https://nombre.workers.dev/posts

-- Recomendaciones, diferenciar trabajar en local / nube (allowedOrigin)  para q CORS en index.ts  no se modifique a cada rato.


```
