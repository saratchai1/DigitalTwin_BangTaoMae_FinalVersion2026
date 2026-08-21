import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ErrorBoundary } from "react-error-boundary";
import { Viewer } from "@itwin/web-viewer-react";
import { BrowserAuthorizationClient } from "@itwin/browser-authorization";
import { Box, ExternalLink, LogIn, Map, TriangleAlert } from "lucide-react";
import "./OperationalITwin.css";

const LEGACY_ITWIN_ID = "e90ae85f-f0a3-46c4-9fa2-e6bcde017517";
const LEGACY_IMODEL_ID = "b410bb70-12fa-4078-b0bb-270d4cee3a24";
const LEGACY_SPA_CLIENT_ID = "spa-ZWo3yd9lvhUw7zW64VUYagXQF";

type AuthState = "pending" | "authorized" | "signed-out" | "error";

function resolveLegacyIds() {
  const params = new URLSearchParams(window.location.search);
  const queryITwin = params.get("iTwinId");
  const queryIModel = params.get("iModelId");

  return {
    iTwinId:
      queryITwin && queryITwin !== "dashboard-mode"
        ? queryITwin
        : import.meta.env.IMJS_ITWIN_ID || LEGACY_ITWIN_ID,
    iModelId:
      queryIModel && queryIModel !== "dashboard-mode"
        ? queryIModel
        : import.meta.env.IMJS_IMODEL_ID || LEGACY_IMODEL_ID,
  };
}

function EmbeddedITwin({ onUseSchematic }: { onUseSchematic: () => void }) {
  const ids = useMemo(resolveLegacyIds, []);
  const [authState, setAuthState] = useState<AuthState>("pending");
  const [authError, setAuthError] = useState<string | null>(null);

  const authClient = useMemo(
    () =>
      new BrowserAuthorizationClient({
        scope: import.meta.env.IMJS_AUTH_CLIENT_SCOPES || "itwin-platform",
        clientId: import.meta.env.IMJS_AUTH_CLIENT_CLIENT_ID || LEGACY_SPA_CLIENT_ID,
        redirectUri: `${window.location.origin}/signin-callback`,
        postSignoutRedirectUri: window.location.origin,
        responseType: "code",
        authority: import.meta.env.IMJS_AUTH_AUTHORITY || "https://ims.bentley.com",
      }),
    [],
  );

  useEffect(() => {
    const removeListener = authClient.onAccessTokenChanged.addListener(() => {
      setAuthError(null);
      setAuthState("authorized");
    });

    void authClient
      .signInSilent()
      .then(() => setAuthState("authorized"))
      .catch(() => setAuthState("signed-out"));

    return removeListener;
  }, [authClient]);

  const signIn = async () => {
    setAuthError(null);
    setAuthState("pending");
    try {
      await authClient.signInPopup();
      setAuthState("authorized");
    } catch (error) {
      setAuthState("error");
      setAuthError(error instanceof Error ? error.message : "Bentley sign-in failed");
    }
  };

  if (authState !== "authorized") {
    return (
      <div className="itwin-operational-shell itwin-operational-auth">
        <div className="itwin-operational-auth-card">
          <div className="itwin-operational-mark"><Box size={22} /></div>
          <div>
            <span className="itwin-operational-eyebrow">BENTLEY iTWIN · LEGACY MODEL</span>
            <h3>Digital Twin 3D ของโครงการเดิม</h3>
            <p>
              ใช้ iTwin/iModel เดิมจากเวอร์ชันก่อนหน้าแทนแผนผังคลองแบบ schematic โดยข้อมูล dashboard ส่วนอื่นยังทำงานแยกกัน
            </p>
          </div>
          {authError && (
            <div className="itwin-operational-error">
              <TriangleAlert size={15} />
              <span>{authError}</span>
            </div>
          )}
          <div className="itwin-operational-actions">
            <button type="button" className="itwin-primary" onClick={() => void signIn()} disabled={authState === "pending"}>
              <LogIn size={15} /> {authState === "pending" ? "กำลังตรวจสอบสิทธิ์…" : "เข้าสู่ระบบ Bentley เพื่อเปิด iTwin"}
            </button>
            <button type="button" className="itwin-secondary" onClick={onUseSchematic}>
              <Map size={15} /> ใช้แผนผังเดิม
            </button>
          </div>
          <small>
            ถ้า Bentley ปฏิเสธ redirect ต้องเพิ่ม URL ของ Netlify Preview ใน Allowed Redirect URIs ของแอป Bentley เดิม
          </small>
        </div>
      </div>
    );
  }

  return (
    <div className="itwin-operational-shell">
      <div className="itwin-operational-toolbar">
        <span><span className="itwin-operational-live" /> iTwin 3D · LEGACY MODEL</span>
        <div>
          <a
            href={`https://connect.bentley.com/`}
            target="_blank"
            rel="noreferrer"
            aria-label="เปิด Bentley Connect"
          >
            <ExternalLink size={14} />
          </a>
          <button type="button" onClick={onUseSchematic}>แผนผังเดิม</button>
        </div>
      </div>
      <ErrorBoundary
        fallbackRender={({ error }) => (
          <div className="itwin-operational-fallback">
            <TriangleAlert size={22} />
            <strong>เปิด iTwin ไม่สำเร็จ</strong>
            <span>{error instanceof Error ? error.message : "Viewer error"}</span>
            <button type="button" onClick={onUseSchematic}>กลับไปใช้แผนผังเดิม</button>
          </div>
        )}
      >
        <div className="itwin-operational-viewer">
          <Viewer
            iTwinId={ids.iTwinId}
            iModelId={ids.iModelId}
            authClient={authClient}
            enablePerformanceMonitors={false}
          />
        </div>
      </ErrorBoundary>
      <div className="itwin-operational-model-id">
        iTwin {ids.iTwinId.slice(0, 8)}… · iModel {ids.iModelId.slice(0, 8)}…
      </div>
    </div>
  );
}

export function OperationalITwinMount() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    const findTarget = () => {
      const next = document.querySelector<HTMLElement>(".schematic-map");
      setTarget((current) => (current === next ? current : next));
    };

    findTarget();
    const observer = new MutationObserver(findTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!target) return null;

  if (!enabled) {
    return createPortal(
      <button type="button" className="itwin-operational-restore" onClick={() => setEnabled(true)}>
        <Box size={14} /> เปิด iTwin 3D
      </button>,
      target,
    );
  }

  return createPortal(<EmbeddedITwin onUseSchematic={() => setEnabled(false)} />, target);
}
