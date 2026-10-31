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
        const app = await createApp();
        await app.listen(0, "127.0.0.1");
        const { port } = app.getHttpServer().address() as AddressInfo;
        return `http://127.0.0.1:${port}`;
    })().catch((err) => {
        originPromise = undefined;
        throw err;
    });
    return originPromise;
};

export default async (req: Request) => {
    const origin = await getOrigin();
    const url = new URL(req.url);
    const hasBody = req.method !== "GET" && req.method !== "HEAD";

    const res = await fetch(origin + url.pathname + url.search, {
        method: req.method,
        headers: req.headers,
        body: hasBody ? req.body : undefined,
        redirect: "manual",
        // @ts-expect-error duplex is required by Node when streaming a request body
        duplex: "half",
    });

    // fetch already decoded the body, so drop headers describing the raw encoding.
    const headers = new Headers(res.headers);
    headers.delete("content-encoding");
    headers.delete("content-length");
    headers.delete("transfer-encoding");

    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
};

export const config: Config = {
    path: "/*",
    preferStatic: true,
};