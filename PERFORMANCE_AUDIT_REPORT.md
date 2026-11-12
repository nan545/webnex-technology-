# Performance Audit Report

**Audit date:** 2026-11-11  
**Measurement environment:** Local production build, integrated browser, development workstation, `http://localhost:3128`. This is a single local lab sample and is not representative of a production network or user device.

## Measurements

One homepage navigation sample reported:

| Metric | Observed | Interpretation |
|---|---:|---|
| TTFB | 624 ms | Local sample; affected by this workstation/runtime and not a production service measurement. |
| DOMContentLoaded | 892 ms | Local sample. |
| Load event | 1,051 ms | Local sample. |
| First Contentful Paint | 976 ms | Local sample. |
| Largest Contentful Paint | Not measured | Browser run produced no valid LCP entry; no value is inferred. |
| INP | Not measured | No representative user interaction or field data was collected. |
| CLS | Not measured | No layout-shift observer result was collected. |

Responsive overflow check ran on the homepage with viewport settings 375, 390, 430, 768, 1024, 1440 and 1920 pixels. Document scroll width matched the browser content width at each setting; no horizontal overflow was observed. This does not cover every page, menu state or device.

The production build compiled successfully and generated static routes where configured. Database-backed content pages were not assessed for query latency because PostgreSQL authentication fails. No Lighthouse, Web Vitals field data, CPU throttling, network throttling, production CDN or database query plan measurements were available.

## Findings and follow-up

- Do not claim Core Web Vitals targets (LCP <= 2.5s, INP <= 200ms, CLS <= 0.1) are met; these values were not measured.
- The public site contains route output and static/generated content, but most content fetching has not been load-tested against real data.
- Admin dashboards and CRM lists were not profiled with authenticated records; database latency and N+1 behavior remain unverified.
- Repeat measurements using Lighthouse or equivalent on the staged production deployment, with mobile throttling and representative content. Capture LCP, INP, CLS, transfer sizes and JavaScript bundles.
- Capture database query plans and timings after an isolated PostgreSQL environment is configured. Add or adjust indexes only based on measured query patterns.
- Retain server rendering for private admin data; never make private responses publicly cacheable as a performance shortcut.

No performance optimization was applied because the available measurements did not establish a code-level bottleneck. A production performance baseline remains outstanding.
