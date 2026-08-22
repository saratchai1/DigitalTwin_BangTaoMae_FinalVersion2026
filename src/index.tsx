/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./index.css";
import "./ui-overrides.css";
import "./visual-qa.css";
import "./dwr-fetch-bridge";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./components/Routes";
import { EnvironmentRiskTint } from "./components/EnvironmentRiskTint";
import { WaterRiskBands } from "./components/WaterRiskBands";
import { OperationalITwinMount } from "./components/OperationalITwin";

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
    <EnvironmentRiskTint />
    <WaterRiskBands />
    {/* Experimental PR #5 only: overlays legacy iTwin inside the Operational Map panel. */}
    <OperationalITwinMount />
  </StrictMode>
);