# DWR theme and DOH PER-14-007

The ownership-role layout from ebc9743 is preserved. DWR navy #05235b and sky #1eb8eb come from https://www.dwr.go.th/css/css.css; white content is the default. The theme button persists a separate btm-dwr-theme preference. Status colors and the actual CCTV/3D images are not recolored.

## Camera

PER-14-007 / highway 4 / control section 1101 / kilometer 956+105, as listed at https://highwaytraffic.go.th/DOHWeb/Home.aspx. The public camera selector (site 3446) returns https://streaming2.highwaytraffic.go.th/PER-14/PER_14_007.stream/playlist.m3u8. The old /Phase14/ URL and cached chunklist session IDs must not be used.

The upstream omits its Sectigo DV R36 intermediate certificate. The server-side proxy supplies the public intermediate after independent verification against the system trust store. It keeps normal chain, expiry and hostname verification enabled, restricts every target and redirect to this camera, bounds responses and timeouts, and rewrites nested HLS references. Never disable TLS verification. The public CA is in netlify/lib so it is bundled as a dependency, not deployed as a separate function.

The player uses the same-origin proxy, native HLS on Safari or hls.js on MSE browsers, an explicit play button when autoplay is blocked, retryable failures and a bounded loading/stall watchdog. A valid playlist alone is not labeled LIVE; the video must actually play. No sample video or unrelated camera is substituted.

## Checks

Run `npm run build` and `node --test tests/doh-proxy.test.mjs`.
For live diagnostics request `/.netlify/functions/doh-hls-proxy?probe=1`. A 200 proves only playlist reachability. In a browser verify videoWidth/videoHeight and increasing currentTime/decoded frames. Check overview and surveillance tabs, narrow layouts, theme switching, reload, pause/play and retry. Upstream outages can still interrupt a public live feed.
