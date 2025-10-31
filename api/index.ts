export interface Env {
  DB: D1Database;
  BLOGFILES: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    //  Lista de orgenes permitidos
    const allowedOrigins = [
      "http://localhost:3000",
      "https://blog-frontend-5dr.pages.dev",
      "https://650242fc.blog-frontend-5dr.pages.dev",
    ];

    const origin = request.headers.get("Origin") || "";
    const isAllowed = allowedOrigins.includes(origin) || origin.endsWith(".pages.dev");

    const corsHeaders = {
      "Access-Control-Allow-Origin": isAllowed ? origin : "",
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
      //  GET /posts - listar publicaciones
      if (url.pathname === "/posts" && request.method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT * FROM posts ORDER BY id DESC"
        ).all();

        return new Response(JSON.stringify(results), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      //  POST /posts - agregar publicacin
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

      // --- Subir archivo a R2 ---
      if (url.pathname === "/upload" && request.method === "POST") {
        const formData = await request.formData();
        const file = formData.get("file");
        if (!file || typeof file === "string")
          return new Response("Archivo no vlido", { status: 400 });

        await env.BLOGFILES.put(file.name, file.stream());
        return new Response(JSON.stringify({ ok: true, name: file.name }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // --- Descargar o ver archivo ---
      if (url.pathname.startsWith("/files/") && request.method === "GET") {
        const fileName = url.pathname.replace("/files/", "");
        const object = await env.BLOGFILES.get(fileName);

        if (!object)
          return new Response("Archivo no encontrado", { status: 404 });

        return new Response(object.body, {
          headers: {
            "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
          },
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

