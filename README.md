# Digital Twin Bang Tao Mae 2026

Command-center dashboard for water, environmental monitoring and site surveillance.

## Environmental & Hazard Intelligence

The Command Center overview uses project coordinates `8.604726, 98.721682` and separates data provenance visibly:

- **TMD OFFICIAL** — TMD Southern West Coast forecast, warning feed and Krabi observation.
- **DWR OFFICIAL** — DWR EWS public station measurements for the Ao Luek / Khlong Ya locality (primary station `STN2113`), including 15-minute rain, 12-hour rain, daily rainfall, water level and station warning state when available.
- **PCD OFFICIAL** — nearest available Air4Thai station for PM2.5/AQI, with a model fallback when the official endpoint is unavailable.
- **MODEL** — exact-coordinate point weather forecast used for 1/3/6/24-hour outlooks and the 7-day forecast.

Dashboard screening labels such as watch/warning are intentionally kept separate from official agency warnings.
