import http from "node:http";
http
  .createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "authorization,apikey,content-type,x-client-info,x-supabase-api-version",
    );
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    );
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    const routes = [
      ["/auth/v1", 54329],
      ["/rest/v1", 54328],
      ["/storage/v1", 54327],
    ];
    const route = routes.find(([prefix]) => req.url.startsWith(prefix));
    if (!route) {
      res.writeHead(404);
      res.end();
      return;
    }
    const headers = { ...req.headers, host: `127.0.0.1:${route[1]}` };
    delete headers.connection;
    const target = http.request(
      {
        hostname: "127.0.0.1",
        port: route[1],
        path: req.url.slice(route[0].length) || "/",
        method: req.method,
        headers,
      },
      (r) => {
        res.writeHead(r.statusCode, r.headers);
        r.pipe(res);
      },
    );
    target.on("error", () => {
      res.writeHead(503);
      res.end('{"message":"Test service unavailable"}');
    });
    req.pipe(target);
  })
  .listen(54321, process.env.LOCAL_GATEWAY_HOST || "127.0.0.1", () =>
    console.log("Local test gateway ready"),
  );
