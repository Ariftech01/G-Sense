# G Sense — Android app

The G Sense companion app: environment awareness, change detection and
preference-aware route guidance for blind and low-vision users.

It is an Expo (React Native) app that runs in two ways:

| Mode | How it runs | Needs Expo Go? |
| --- | --- | --- |
| Development | `pnpm dev` → Expo Go / dev server | Yes |
| **Standalone APK** | **Install `G Sense.apk` and tap the icon** | **No** |

The APK produced by this guide is a normal Android application. It has its own
**G Sense** launcher icon and splash screen, launches from the home screen, and
does **not** need Expo Go, Metro, a development server, a USB cable or a laptop.

---

## Running in development

```bash
# from the repository root
pnpm install

# start the backend (needs DATABASE_URL), then the app
pnpm --filter @workspace/api-server run dev
pnpm --dir artifacts/access-x-mobile run dev
```

`pnpm run dev` starts Metro and prints a QR code for Expo Go. Set
`EXPO_PUBLIC_DOMAIN=localhost:5000` (see `start-gsense.ps1`) to point the app at a
local backend.

---

## BUILDING THE G SENSE APK

### Prerequisites

- Node.js 20+ and pnpm
- An Expo account (`https://expo.dev/signup`) — free
- The backend deployed and reachable over HTTPS (see
  [Production API configuration](#production-api-configuration))

You do **not** need Android Studio, the Android SDK or a JDK on your machine for
the cloud build; EAS builds the APK on Expo's servers.

### 1. Installation

```bash
# from the repository root
pnpm install
```

### 2. EAS setup

```bash
npm install -g eas-cli
eas login          # sign in with your Expo account
```

The project is already linked to an EAS project
(`extra.eas.projectId` in `app.json`). If you fork or clone this repository and
need to link your own project:

```bash
cd artifacts/access-x-mobile
eas init
```

### 3. Build command

Run the build **from the mobile app directory**:

```bash
cd artifacts/access-x-mobile
eas build --platform android --profile preview
```

`--profile preview` is the installable-APK profile defined in `eas.json`:

```json
"preview": {
  "distribution": "internal",
  "android": { "buildType": "apk" }
}
```

`buildType: "apk"` is what makes this produce a directly installable **APK**
instead of a Play Store `.aab`. Add `--wait` to block until the build finishes,
and `--non-interactive` for CI.

> The first build asks whether to generate an Android keystore. Answer **yes**:
> EAS creates and stores the signing key for you. Keep the same EAS project for
> future releases so the app can be upgraded in place.

Use the `production` profile (`android.buildType: "app-bundle"`) when you want a
Play Store upload artifact instead.

### 4. Download the APK

When the build finishes, the CLI prints a build page URL such as
`https://expo.dev/accounts/<account>/projects/gsense/builds/<id>`.

- **EAS dashboard** — open that URL and use **Download** to get the `.apk`.
- **CLI** — list and open your builds:

```bash
eas build:list --platform android
eas build:view --platform android
```

Rename the downloaded file to `G Sense.apk` if you like — the file name does not
affect the installed app name.

### 5. Install on Android

1. Copy `G Sense.apk` to the phone (download link, Google Drive, Telegram,
   USB, …).
2. Tap the file in the phone's Files app.
3. Android asks to allow installing from this source — allow it.
   *(Settings → Apps → Special access → Install unknown apps)*
4. Tap **Install**.

### 6. Open G Sense

Find the **G Sense** icon (blue tile with a white "G") on the home screen or in
the app drawer and tap it. The G Sense splash screen appears briefly, then the
app opens. No Expo Go, Metro, laptop or cable is involved.

---

## Production API configuration

The app talks to the G Sense backend through a base URL that is resolved at
startup by `lib/api-config.ts`, in this order:

1. `EXPO_PUBLIC_API_URL` — the production knob.
2. `EXPO_PUBLIC_DOMAIN` — the existing Expo Go / static-bundle convention.
3. `http://localhost:5000` — development builds only.

Because Expo inlines `EXPO_PUBLIC_*` variables at build time, the URL must be set
**before** the build. Put it in the build profile in `eas.json`:

```json
"preview": {
  "distribution": "internal",
  "android": { "buildType": "apk" },
  "env": {
    "EXPO_PUBLIC_API_URL": "https://your-production-api-url"
  }
}
```

…then rebuild. Both a full URL (`https://api.example.com`) and a bare host
(`api.example.com`) are accepted; a bare host gets `https://`, except for
loopback and private-LAN addresses, which get `http://` (so you can point a demo
build at a laptop backend such as `http://192.168.1.20:5000`).

If no URL is configured, or the configured backend cannot be reached, the app
shows *"AI service is currently unavailable. Please check your connection and
try again."* instead of inventing results.

### Secrets

`EXPO_PUBLIC_*` values are **embedded in the APK and readable**. Never put a
`GEMINI_API_KEY`, database password, service-role key or other credential in the
mobile app or in `eas.json`. AI keys belong on the backend only; the app reaches
the AI through the backend API.

---

## Permissions

| Permission | Why | Runtime behaviour |
| --- | --- | --- |
| `CAMERA` | Capture the path ahead, OCR signs and documents | Requested the first time you tap **Scan path**. Denial is handled with an explanatory dialog; the app keeps working without the camera. |
| `RECORD_AUDIO` | Voice input for **Ask G Sense** | Only requested when the app accesses the microphone. Denial does not crash the app. |
| Location | *Not used by the shipped screens* | `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` are explicitly blocked in `app.json` because no screen calls `expo-location`. Remove them from `blockedPermissions` if you add a location feature. |

No notification permission is requested: G Sense does not post notifications.

---

## Troubleshooting

**"AI service is currently unavailable" in the APK**
The build has no reachable backend URL. Set `EXPO_PUBLIC_API_URL` in the
`preview` profile in `eas.json` (see above) and rebuild. A phone can never reach
`localhost` or `127.0.0.1` — that address means the phone itself.

**Camera screen does not open / permission dialog never appears**
Deny-then-retry can leave the permission permanently denied. Re-enable it in
*Settings → Apps → G Sense → Permissions → Camera*.

**Build fails: "Package name ... already exists"**
The Android package ID `com.gsense.accessibility` is already taken on the Play
Store. For a personal build, change `android.package` in `app.json` — never
change it after a release, or Android treats the build as a different app.

**Build fails while installing dependencies**
EAS installs from the repository root because this is a pnpm monorepo. Commit
(or at least keep uncommitted) the workspace files (`pnpm-workspace.yaml`,
`pnpm-lock.yaml`) and run the build from `artifacts/access-x-mobile`.

**App opens to a blank screen**
Check Metro logs from a development run for a bundling error. The APK bundles
JavaScript at build time, so a runtime error in a screen shows the G Sense error
screen with a **Try Again** button.

---

## Project layout

| Path | Purpose |
| --- | --- |
| `app/` | Expo Router screens (`index`, `profile`, `changes`) |
| `components/` | Shared UI (`ConnectionNotice`, error fallback) |
| `lib/api-config.ts` | Backend base-URL resolution |
| `assets/images/` | `icon.png`, `adaptive-icon.png`, `splash-icon.png` |
| `app.json` | Expo app config: name, package ID, icons, splash, permissions |
| `eas.json` | EAS build profiles (`preview` → installable APK) |
| `scripts/build.js`, `server/` | Legacy Expo Go static-bundle deployment (unchanged) |
