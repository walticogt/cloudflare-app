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

