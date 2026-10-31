import type { Config } from "@netlify/functions";
import type { AddressInfo } from "node:net";
// Import the tsc output: Nest's dependency injection relies on decorator
// metadata, which the function bundler can't emit from TypeScript sources.
import { createApp } from "../../dist/app.factory.js";

let originPromise: Promise<string> | undefined;

// Boot the Nest app once per function instance on a loopback port and reuse it
// across invocations.
const getOrigin = () => {
    originPromise ??= (async () => {
        console.log("Bootstrapping NestJS application in Netlify function...");
        const app = await createApp();
        await app.listen(0, "127.0.0.1");
        const { port } = app.getHttpServer().address() as AddressInfo;
        console.log(`NestJS application listening on internal port ${port}`);
        return `http://127.0.0.1:${port}`;
    })().catch((err) => {
        console.error("FATAL: Failed to bootstrap NestJS app:", err);
        originPromise = undefined;
        throw err;
    });
    return originPromise;
};

export default async (req: Request) => {
    try {
        const origin = await getOrigin();
        const url = new URL(req.url);
        const hasBody = req.method !== "GET" && req.method !== "HEAD";
        const body = hasBody ? await req.arrayBuffer() : undefined;

        const forwardHeaders = new Headers(req.headers);
        forwardHeaders.delete("host");
        forwardHeaders.delete("connection");

        const res = await fetch(origin + url.pathname + url.search, {
            method: req.method,
            headers: forwardHeaders,
            body,
            redirect: "manual",
        });

        // fetch already decoded the body, so drop headers describing the raw encoding.
        const headers = new Headers(res.headers);
        headers.delete("content-encoding");
        headers.delete("content-length");
        headers.delete("transfer-encoding");

        return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
    } catch (error: any) {
        console.error("Netlify Function handler error:", error);
        return new Response(
            JSON.stringify({
                statusCode: 500,
                error: "Netlify Function Handler Error",
                message: error?.message || String(error),
                stack: error?.stack,
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
};

export const config: Config = {
    path: "/*",
    preferStatic: true,
};
