/*
 * Fern — Scramjet 2 Service Worker
 *
 * Scramjet 2 provides the actual service-worker
 * interception logic through controller.sw.js.
 *
 * This file is intentionally kept separate from
 * Fern's existing Ultraviolet service worker so
 * UV and Scramjet can coexist.
 */

importScripts("/controller/controller.sw.js");

/*
 * Take control of already-open Fern pages as soon
 * as the worker activates.
 */
self.addEventListener("activate", (event) => {
    event.waitUntil(
        self.clients.claim()
    );
});

/*
 * Scramjet 2 decides whether a request belongs
 * to a Scramjet frame.
 *
 * Requests that aren't owned by Scramjet are passed
 * normally to the network.
 */
self.addEventListener("fetch", (event) => {
    event.respondWith(
        (async () => {
            try {
                if (
                    typeof $scramjetController !== "undefined" &&
                    $scramjetController.shouldRoute(event)
                ) {
                    return await $scramjetController.route(event);
                }

                return fetch(event.request);
            } catch (error) {
                console.error(
                    "[Fern/Scramjet] Request handling failed:",
                    error
                );

                return fetch(event.request);
            }
        })()
    );
});
