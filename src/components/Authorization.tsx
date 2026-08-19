/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";
import { BrowserAuthorizationClient } from "@itwin/browser-authorization";

export enum AuthorizationState {
  Pending,
  Authorized,
  SignedOut,
}

export interface AuthorizationContext {
  client: BrowserAuthorizationClient;
  state: AuthorizationState;
}

const authorizationContext = createContext<AuthorizationContext>({
  client: new BrowserAuthorizationClient({
    clientId: "",
    redirectUri: "",
    scope: "",
  }),
  state: AuthorizationState.Pending,
});

export function useAuthorizationContext() {
  return useContext(authorizationContext);
}

// Bypass CORS for Bentley IMS by proxying fetch requests through the Vite dev server

const createAuthClient = (): AuthorizationContext => {
  const redirectUri = `${window.location.origin}/signin-callback`;
  const authorityUrl = import.meta.env.IMJS_AUTH_AUTHORITY || "https://ims.bentley.com";
  
  const client = new BrowserAuthorizationClient({
    scope: import.meta.env.IMJS_AUTH_CLIENT_SCOPES ?? "",
    clientId: import.meta.env.IMJS_AUTH_CLIENT_CLIENT_ID ?? "",
    redirectUri,
    postSignoutRedirectUri: window.location.origin,
    responseType: "code",
    authority: authorityUrl,
  });

  return {
    client,
    state: AuthorizationState.Pending,
  };
};

export function AuthorizationProvider(props: PropsWithChildren<unknown>) {
  const [contextValue, setContextValue] = useState<AuthorizationContext>(() =>
    createAuthClient()
  );

  const authClient = contextValue.client;
  useEffect(() => {
    return authClient.onAccessTokenChanged.addListener(() =>
      setContextValue((prev) => ({
        ...prev,
        state: AuthorizationState.Authorized,
      }))
    );
  }, [authClient]);

  useEffect(() => {
    const signIn = async () => {
      try {
        await authClient.signInSilent();
      } catch {
        setContextValue((prev) => ({
          ...prev,
          state: AuthorizationState.SignedOut,
        }));
      }
    };

    void signIn();
  }, [authClient]);

  return (
    <authorizationContext.Provider value={contextValue}>
      {props.children}
    </authorizationContext.Provider>
  );
}

export function SignInRedirect() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const completeSignIn = async () => {
      try {
        const url = window.location.href;
        
        // If we are in a popup window (which is the case for signInPopup)
        if (window.opener && window.opener !== window) {
          const msgData = {
            source: "oidc-client",
            url,
            keepOpen: false
          };
          
          // Send the URL back to the opener window where the UserManager is waiting
          window.opener.postMessage(msgData, window.location.origin);
          
          // Close the popup
          window.close();
        } else {
          // Fallback if not in a popup (e.g., redirect flow)
          // We need to import the client from context to handle this
          // But since we are enforcing popup flow, this shouldn't be reached normally.
          setError("This page should only be loaded in a popup window during sign-in.");
        }
      } catch (err: any) {
        setError(err.message || "Unknown error");
      }
    };
    
    void completeSignIn();
  }, []);

  if (error) {
    return (
      <div style={{ padding: "2rem", color: "red", fontFamily: "sans-serif" }}>
        <h2>Authentication Error</h2>
        <p>{error}</p>
        {error.includes("Failed to fetch") && (
          <p style={{ marginTop: "1rem", fontWeight: "bold" }}>
            This is likely a CORS issue. Please ensure you have added this app&apos;s URL to the &quot;Allowed Origins&quot; in your Bentley Developer Portal.
          </p>
        )}
      </div>
    );
  }

  return <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>Completing sign in...</div>;
}
