import { Outlet } from "@tanstack/react-router";
import { AuthorizationProvider } from "./Authorization";
import { ThemeProvider } from "@itwin/itwinui-react";

export function RootLayout() {
  return (
    <ThemeProvider>
      <AuthorizationProvider>
        <Outlet />
      </AuthorizationProvider>
    </ThemeProvider>
  );
}
