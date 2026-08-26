import v1a from "./v1a";
import v1b from "./v1b";
import v1c from "./v1c";
import v2a from "./v2a";
import v2b from "./v2b";
import v2c from "./v2c";
import v3a from "./v3a";
import v3b from "./v3b";
import v3c from "./v3c";
import v4a from "./v4a";
import v4b from "./v4b";
import v5a from "./v5a";
import v5b from "./v5b";
import v6a from "./v6a";
import v6b from "./v6b";

const webp = (base64: string) => `data:image/webp;base64,${base64}`;

export const projectGalleryImages = [
  webp(v1a + v1b + v1c),
  webp(v2a + v2b + v2c),
  webp(v3a + v3b + v3c),
  webp(v4a + v4b),
  webp(v5a + v5b),
  webp(v6a + v6b),
] as const;
