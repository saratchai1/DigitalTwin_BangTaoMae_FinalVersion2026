/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./index.css";
import operationalTwinPhoto from "./assets/operational-twin-reservoir.webp";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./components/Routes";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");
const root = createRoot(rootElement);

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

root.render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);

const mountOperationalTwinPhoto = () => {
  const map = document.querySelector<HTMLElement>(".cc2-ops-grid > .cc2-panel:first-child .cc2-map");
  if (!map || map.querySelector(".cc2-operational-photo")) return;

  const image = document.createElement("img");
  image.className = "cc2-operational-photo";
  image.src = operationalTwinPhoto;
  image.alt = "ภาพพื้นที่โครงการบางเท่าแม่";
  image.decoding = "async";
  image.draggable = false;
  map.prepend(image);
};

const operationalTwinObserver = new MutationObserver(mountOperationalTwinPhoto);
operationalTwinObserver.observe(rootElement, { childList: true, subtree: true });
window.requestAnimationFrame(mountOperationalTwinPhoto);
