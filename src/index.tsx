/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./index.css";
import "@itwin/itwinui-react/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./components/Routes";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");
const root = createRoot(rootElement);

const clientId = import.meta.env.IMJS_AUTH_CLIENT_CLIENT_ID;
const scopes = import.meta.env.IMJS_AUTH_CLIENT_SCOPES;

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

if (!clientId || clientId === "YOUR_CLIENT_ID") {
  root.render(
    <div style={{ padding: "2rem", fontFamily: "sans-serif", color: "red" }}>
      <h1>Configuration Error</h1>
      <p>Please add a valid OIDC client id to the .env file (IMJS_AUTH_CLIENT_CLIENT_ID) and restart.</p>
    </div>
  );
} else if (!scopes) {
  root.render(
    <div style={{ padding: "2rem", fontFamily: "sans-serif", color: "red" }}>
      <h1>Configuration Error</h1>
      <p>Please add valid scopes for your OIDC client to the .env file (IMJS_AUTH_CLIENT_SCOPES) and restart.</p>
    </div>
  );
} else {
  if (!rootElement.innerHTML) {
    root.render(
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>
    );
  }
}
