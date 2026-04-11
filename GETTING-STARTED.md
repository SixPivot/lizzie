# Getting Started

Developer onboarding guide for the AzDO Project Management app.

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | ≥ 20 | [nodejs.org](https://nodejs.org) — use the LTS release |
| npm | ≥ 10 | Bundled with Node.js |
| Git | any | [git-scm.com](https://git-scm.com) |

### Platform-specific native build tools

Electron requires native compilation tooling to build certain dependencies.

**Windows**

Install the Visual Studio Build Tools (C++ workload):

```powershell
winget install Microsoft.VisualStudio.2022.BuildTools --override "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --quiet --wait"
```

Or download the installer from [visualstudio.microsoft.com/downloads](https://visualstudio.microsoft.com/downloads/) and select **Desktop development with C++**.

**macOS**

Install Xcode Command Line Tools:

```bash
xcode-select --install
```

**Linux (Debian/Ubuntu)**

```bash
sudo apt-get install build-essential libgtk-3-dev libnotify-dev libgconf-2-4 libnss3 libxss1 libasound2
```

---

## Clone and install

```bash
git clone https://github.com/becdetat/azdo-project-management-thing.git
cd azdo-project-management-thing
npm ci
```

Use `npm ci` (not `npm install`) to get a reproducible install that matches the lockfile exactly.

---

## Run in development mode

```bash
npm start
```

This starts the Vite dev server for the renderer (with HMR) and the Electron main process together via electron-forge. The app window opens automatically.

The renderer dev server runs at `http://localhost:5173` — you can open it in a browser to inspect the UI, though some Electron-specific features (IPC, window controls) only work inside the app window.

---

## Run tests

```bash
npm test
```

Tests use [Vitest](https://vitest.dev). Co-located test files follow the pattern `*.test.ts` / `*.test.tsx`.

---

## Build and package

Each platform produces its own installer/distributable. You must run the build on the target OS.

```bash
npm run make
```

Output artefacts are written to `out/make/`:

| Platform | Output |
|----------|--------|
| Windows | `out/make/squirrel.windows/` — `.exe` installer |
| macOS | `out/make/zip/darwin/` — `.zip` archive |
| Linux | `out/make/deb/` and `out/make/rpm/` |

To produce only a packaged app (no installer):

```bash
npm run package
```

Output goes to `out/azdo-project-management-thing-<platform>-<arch>/`.

---

## Project structure

```
.
├── forge.config.ts           # electron-forge config (makers, plugins)
├── vite.main.config.ts       # Vite config for the main process
├── vite.preload.config.ts    # Vite config for the preload script
├── vite.renderer.config.ts   # Vite config for the renderer (React)
├── postcss.config.mjs        # PostCSS config (TailwindCSS v4)
├── index.html                # Renderer entry HTML
├── src/
│   ├── main.ts               # Electron main process
│   ├── preload.ts            # Preload script (contextBridge IPC bridge)
│   ├── renderer.tsx          # Renderer entry point (React root)
│   ├── index.css             # Global styles (Tailwind import)
│   ├── shared/
│   │   ├── electronAPI.ts    # Shared ElectronAPI interface
│   │   └── globals.d.ts      # Window type augmentation
│   └── renderer/
│       ├── App.tsx           # Root layout (TitleBar + Outlet)
│       ├── router/
│       │   └── router.tsx    # React Router hash router
│       ├── store/
│       │   └── appStore.ts   # Zustand store (pattern scaffold)
│       ├── pages/
│       │   ├── CombinedBoardPage.tsx
│       │   ├── LocalSyncPage.tsx
│       │   └── SettingsPage.tsx
│       └── components/
│           └── TitleBar/
│               ├── TitleBar.tsx
│               └── WindowControls.tsx
└── feature-specifications/   # Feature specs written before implementation
```

---

## CI/CD

A GitHub Actions workflow at [`.github/workflows/build.yml`](.github/workflows/build.yml) runs on every push to `main` that touches source files. It builds and packages the app in parallel across Windows, macOS, and Linux, and uploads the artefacts.

See the workflow file for details, or the [Actions tab](../../actions) on GitHub to view run history.
