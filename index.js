import express from "express";
import http from "node:http";
import { createBareServer } from "@tomphttp/bare-server-node";
import cors from "cors";
import path from "node:path";
import { hostname } from "node:os";
import { createRequire } from "node:module";
import { scramjetPath } from "@mercuryworkshop/scramjet/path";

const require = createRequire(import.meta.url);

const server = http.createServer();
const app = express(server);

const __dirname = process.cwd();

const bareServer = createBareServer("/b/");

const dirOf = (specifier) => path.dirname(require.resolve(specifier));

/*
 * ============================================
 * BASIC EXPRESS CONFIGURATION
 * ============================================
 */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

/*
 * ============================================
 * CROSS-ORIGIN ISOLATION
 * ============================================
 *
 * Scramjet 2 can make use of cross-origin
 * isolation for features such as SharedArrayBuffer.
 */

app.use((_req, res, next) => {
    res.setHeader(
        "Cross-Origin-Opener-Policy",
        "same-origin"
    );

    res.setHeader(
        "Cross-Origin-Embedder-Policy",
        "require-corp"
    );

    next();
});

/*
 * ============================================
 * SCRAMJET 2 STATIC ASSETS
 * ============================================
 */

app.use(
    "/scram/",
    express.static(scramjetPath)
);

app.use(
    "/utils/",
    express.static(
        dirOf("@mercuryworkshop/scramjet-utils")
    )
);

app.use(
    "/controller/",
    express.static(
        dirOf("@mercuryworkshop/scramjet-controller")
    )
);

app.use(
    "/libcurl/",
    express.static(
        dirOf("@mercuryworkshop/libcurl-transport")
    )
);

/*
 * ============================================
 * EXISTING FERN PUBLIC FILES
 * ============================================
 */

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

/*
 * ============================================
 * FERN ROUTES
 * ============================================
 */

app.get("/", (req, res) => {
    res.sendFile(
        path.join(
            process.cwd(),
            "public",
            "index.html"
        )
    );
});

app.get("/index", (req, res) => {
    res.sendFile(
        path.join(
            process.cwd(),
            "public",
            "index.html"
        )
    );
});

/*
 * ============================================
 * BARE SERVER ROUTING
 * ============================================
 *
 * UV currently uses /b/.
 * Keep this working so UV remains available
 * alongside Scramjet 2.
 */

server.on("request", (req, res) => {
    if (bareServer.shouldRoute(req)) {
        bareServer.routeRequest(req, res);
        return;
    }

    app(req, res);
});

/*
 * ============================================
 * BARE WEBSOCKET UPGRADES
 * ============================================
 *
 * Keep the existing WebSocket support used
 * by the current Bare server.
 */

server.on("upgrade", (req, socket, head) => {
    if (bareServer.shouldRoute(req)) {
        bareServer.routeUpgrade(
            req,
            socket,
            head
        );
        return;
    }

    socket.end();
});

/*
 * ============================================
 * SERVER STARTUP
 * ============================================
 */

const PORT = process.env.PORT || 3000;

server.on("listening", () => {
    const address = server.address();

    if (!address || typeof address === "string") {
        console.log("Fern server started.");
        return;
    }

    console.log("Fern server is listening on:");

    console.log(
        `\thttp://localhost:${address.port}`
    );

    console.log(
        `\thttp://${hostname()}:${address.port}`
    );

    console.log(
        `\thttp://${address.family === "IPv6"
            ? `[${address.address}]`
            : address.address
        }:${address.port}`
    );
});

server.listen({
    port: PORT
});

/*
 * ============================================
 * CLEAN SHUTDOWN
 * ============================================
 */

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
    console.log(
        "Shutdown signal received. Closing Fern server..."
    );

    server.close(() => {
        try {
            bareServer.close();
        } catch (error) {
            console.warn(
                "Unable to close Bare server cleanly:",
                error
            );
        }

        process.exit(0);
    });
}
```
