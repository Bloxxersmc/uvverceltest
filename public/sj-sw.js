/*
 * Fern — Scramjet 2 Service Worker
 *
 * Scramjet 2's controller package provides the actual
 * service-worker implementation.
 *
 * Fern keeps this separate from the existing UV worker.
 */

importScripts("/controller/controller.sw.js");

/*
 * Allow the worker to take control immediately after
 * installation.
 */
self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        self.clients.claim()
    );
});
