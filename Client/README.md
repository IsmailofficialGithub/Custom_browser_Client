# HOSTRIF Client (AdsPower Sequential Runner)

A dedicated, lightweight Electron desktop application built solely for **AdsPower Sequential Profile Execution**. It eliminates all bloat (view-botting, traffic curve pacing, ShardX binaries, database credentials) and focuses 100% on reliable, disposable profile management for AdsPower.

## Features

- **Sequential Manual Browsing**: Creates a profile for each proxy, opens AdsPower browser, waits for you to finish and close the window, and automatically advances to the next profile.
- **Auto-Delete (Disposable)**: Immediately deletes the temporary profile as soon as the browser window closes to keep AdsPower clean.
- **Robust Proxy Parsing**: Accepts standard formats (`host:port:user:pass`, `protocol://user:pass@host:port`, `user:pass:host:port`, or plain `host:port`).
- **Flexible Proxy Input**: Direct multiline paste or click **Load File** (`.txt` / `.json`).
- **Real-Time Live HUD**: Active profile name, current proxy, live progress bar, skip/stop controls, and a color-coded activity terminal.
- **Local API Status Indicator**: Automatic health-check against AdsPower Local API with configurable endpoint and API key.

---

## Prerequisites

1. **AdsPower**: Ensure AdsPower is running on your machine and the **Local API** is enabled (default port `50425`).
2. **Node.js**: Node 18 or newer.

---

## How to Run

From this folder (`./hostrif-client`):

```bash
# If running standalone
npm start
```

Or from the root `Money_browser` directory:
```bash
npx electron hostrif-client
```

---

## Running Tests

To verify proxy parsing:
```bash
npm test
```
