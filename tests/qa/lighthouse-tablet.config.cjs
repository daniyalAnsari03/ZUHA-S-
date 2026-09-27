/**
 * Lighthouse preset for tablet widths.
 *
 * Lighthouse ships only `mobile` and `desktop` presets, so the tablet
 * measurement (the one device class that must not regress) is defined here:
 * a tablet viewport (768x1024 @2x) on the same throttled 4G + 4x-CPU budget as
 * the mobile preset, so tablet numbers are comparable to mobile rather than to
 * an unthrottled desktop run.
 */
module.exports = {
  extends: "lighthouse:default",
  settings: {
    formFactor: "mobile",
    screenEmulation: {
      mobile: true,
      width: 768,
      height: 1024,
      deviceScaleFactor: 2,
      disabled: false,
    },
    throttlingMethod: "simulate",
    throttling: {
      rttMs: 150,
      throughputKbps: 1638.4,
      requestLatencyMs: 562.5,
      downloadThroughputKbps: 1474.56,
      uploadThroughputKbps: 675,
      cpuSlowdownMultiplier: 4,
    },
  },
};
