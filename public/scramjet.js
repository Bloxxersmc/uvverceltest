/*
 * Fern — Scramjet 2 browser runtime
 *
 * This file initializes one Scramjet 2 controller for Fern.
 * It does NOT replace Ultraviolet.
 */

(() => {
    "use strict";

    let controllerPromise = null;
    let controller = null;

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const existing = document.querySelector(
                `script[data-scramjet-src="${src}"]`
            );

            if (existing) {
                resolve();
                return;
            }

            const script = document.createElement("script");

            script.src = src;
            script.dataset.scramjetSrc = src;
            script.async = false;

            script.onload = () => resolve();

            script.onerror = () => {
                reject(
                    new Error(
                        `[Fern/Scramjet] Failed to load ${src}`
                    )
                );
            };

            document.head.appendChild(script);
        });
    }

    async function registerServiceWorker() {
        if (!("serviceWorker" in navigator)) {
            throw new Error(
                "This browser does not support service workers."
            );
        }

        const registration =
            await navigator.serviceWorker.register(
                "/sj-sw.js",
                {
                    scope: "/",
                    updateViaCache: "none"
                }
            );

        await navigator.serviceWorker.ready;

        /*
         * A newly registered worker normally needs one
         * navigation before it becomes controller.
         *
         * Wait for controllerchange instead of creating
         * the Scramjet controller against an inactive worker.
         */
        if (!navigator.serviceWorker.controller) {
            await new Promise((resolve) => {
                const timeout = setTimeout(
                    resolve,
                    5000
                );

                navigator.serviceWorker.addEventListener(
                    "controllerchange",
                    () => {
                        clearTimeout(timeout);
                        resolve();
                    },
                    {
                        once: true
                    }
                );
            });
        }

        const serviceworker =
            navigator.serviceWorker.controller ||
            registration.active;

        if (!serviceworker) {
            throw new Error(
                "Scramjet service worker did not become active."
            );
        }

        return serviceworker;
    }

    async function createController() {
        /*
         * Register the worker first.
         */
        const serviceworker =
            await registerServiceWorker();

        /*
         * Load order matters:
         *
         * 1. Scramjet core
         * 2. Controller API
         * 3. Scramjet utilities
         */
        await loadScript(
            "/scram/scramjet.js"
        );

        await loadScript(
            "/controller/controller.api.js"
        );

        await loadScript(
            "/utils/scramjet-utils.js"
        );

        if (!window.$scramjetController) {
            throw new Error(
                "Scramjet controller API failed to load."
            );
        }

        /*
         * Scramjet 2's controller uses the v2 transport
         * interface. libcurl-transport 2.x is loaded as
         * an ES module.
         */
        const {
            default: LibcurlClient
        } = await import(
            "/libcurl/index.mjs"
        );

        const scheme =
            location.protocol === "https:"
                ? "wss:"
                : "ws:";

        /*
         * The current server configuration needs to
         * expose the transport endpoint. This URL is
         * intentionally kept centralized here so it is
         * easy to change when the server transport is
         * wired in the next step.
         */
        const wispUrl =
            `${scheme}//${location.host}/wisp/`;

        const transport =
            new LibcurlClient({
                wisp: wispUrl
            });

        /*
         * Create one controller for the entire Fern page.
         */
        const Controller =
            window.$scramjetController.Controller;

        controller = new Controller({
            serviceworker,
            transport,

            config: {
                prefix: "/~/sj/",
                scramjetPath:
                    "/scram/scramjet.js",
                wasmPath:
                    "/scram/scramjet.wasm",
                injectPath:
                    "/controller/controller.inject.js"
            }
        });

        /*
         * Do not create frames until the controller
         * has completed its worker/wasm handshake.
         */
        await controller.wait();

        /*
         * Keep the service worker alive.
         *
         * Scramjet 2 keeps its routing table in the
         * service worker. An idle worker can be terminated
         * by the browser, so the current architecture
         * uses a lightweight keepalive message.
         */
        setInterval(() => {
            const activeController =
                navigator.serviceWorker.controller;

            if (activeController) {
                activeController.postMessage(
                    "keepalive"
                );
            }
        }, 15000);

        console.log(
            "[Fern/Scramjet] Scramjet 2 controller ready."
        );

        return controller;
    }

    /*
     * Public initializer.
     *
     * Calling this repeatedly returns the same promise,
     * preventing multiple controllers from being created.
     */
    window.FernScramjet = {
        async init() {
            if (!controllerPromise) {
                controllerPromise =
                    createController().catch(
                        (error) => {
                            controllerPromise =
                                null;

                            console.error(
                                "[Fern/Scramjet] Initialization failed:",
                                error
                            );

                            throw error;
                        }
                    );
            }

            return controllerPromise;
        },

        getController() {
            return controller;
        },

        isReady() {
            return !!controller;
        },

        createFrame(iframe, options = {}) {
            if (!controller) {
                throw new Error(
                    "Scramjet 2 has not been initialized yet. Call FernScramjet.init() first."
                );
            }

            return controller.createFrame(
                iframe,
                options
            );
        }
    };
})();
