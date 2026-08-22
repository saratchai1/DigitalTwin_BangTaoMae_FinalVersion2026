/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./Routes.css";
import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { SignInRedirect } from "./Authorization";
import { RootLayout } from "./RootLayout";
import { App } from "./App";
import "./WorldClassDashboard.css";

const rootRoute = createRootRoute({
  component: RootLayout,
});

interface IndexSearchParams {
  iTwinId: string;
  iModelId: string;
  changesetId?: string;
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  validateSearch: (search: Record<string, unknown>): IndexSearchParams => {
    const iTwinId =
      (search.iTwinId as string | undefined) ?? import.meta.env.IMJS_ITWIN_ID;
    const iModelId =
      (search.iModelId as string | undefined) ?? import.meta.env.IMJS_IMODEL_ID;
    const changesetId = search.changesetId as string | undefined;
    return {
      iTwinId: iTwinId || "dashboard-mode",
      iModelId: iModelId || "dashboard-mode",
      changesetId,
    };
  },
  path: "/",
  component: function Index() {
    const { iTwinId, iModelId, changesetId } = indexRoute.useSearch();
    return (
      <div className="viewer-container">
        <App
          iTwinId={iTwinId}
          iModelId={iModelId}
          changesetId={changesetId}
        />
      </div>
    );
  },
});

const signinRedirectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/signin-callback",
  component: SignInRedirect,
});

const routeTree = rootRoute.addChildren([indexRoute, signinRedirectRoute]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
});
