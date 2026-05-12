# <img src="https://matterbridge.io/assets/matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge somfy tahoma plugin

[![npm version](https://img.shields.io/npm/v/matterbridge-somfy-tahoma.svg)](https://www.npmjs.com/package/matterbridge-somfy-tahoma)
[![npm downloads](https://img.shields.io/npm/dt/matterbridge-somfy-tahoma.svg)](https://www.npmjs.com/package/matterbridge-somfy-tahoma)
[![Docker Version](https://img.shields.io/docker/v/luligu/matterbridge/latest?label=docker%20version)](https://hub.docker.com/r/luligu/matterbridge)
[![Docker Pulls](https://img.shields.io/docker/pulls/luligu/matterbridge?label=docker%20pulls)](https://hub.docker.com/r/luligu/matterbridge)
![Node.js CI](https://github.com/Luligu/matterbridge-somfy-tahoma/actions/workflows/build.yml/badge.svg)
![CodeQL](https://github.com/Luligu/matterbridge-somfy-tahoma/actions/workflows/codeql.yml/badge.svg)
[![codecov](https://codecov.io/gh/Luligu/matterbridge-somfy-tahoma/branch/main/graph/badge.svg)](https://codecov.io/gh/Luligu/matterbridge-somfy-tahoma)
[![styled with prettier](https://img.shields.io/badge/styled_with-Prettier-f8bc45.svg?logo=prettier)](https://github.com/prettier/prettier)
[![linted with eslint](https://img.shields.io/badge/linted_with-ES_Lint-4B32C3.svg?logo=eslint)](https://github.com/eslint/eslint)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![ESM](https://img.shields.io/badge/ESM-Node.js-339933?logo=node.js&logoColor=white)](https://nodejs.org/api/esm.html)
[![matterbridge.io](https://img.shields.io/badge/matterbridge.io-online-brightgreen)](https://matterbridge.io)

[![powered by](https://img.shields.io/badge/powered%20by-matterbridge-blue)](https://www.npmjs.com/package/matterbridge)
[![powered by](https://img.shields.io/badge/powered%20by-matter--history-blue)](https://www.npmjs.com/package/matter-history)
[![powered by](https://img.shields.io/badge/powered%20by-node--ansi--logger-blue)](https://www.npmjs.com/package/node-ansi-logger)
[![powered by](https://img.shields.io/badge/powered%20by-node--persist--manager-blue)](https://www.npmjs.com/package/node-persist-manager)

---

This plugin allows to expose to matter the Somfy TaHoma screens.

It exposes also the stateless screens that don't show up in the TaHoma HomeKit bridge because they don't have a bidirectional radio. The plugin resolves the problem counting the time of the screen movement (see Usage section).

If you like this project and find it useful, please consider giving it a star on [GitHub](https://github.com/Luligu/matterbridge-somfy-tahoma) and sponsoring it.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/assets/bmc-button.svg" alt="Buy me a coffee" width="120"></a>

## Prerequisites

### Matterbridge

Follow these steps to install or update Matterbridge if it is not already installed and up to date:

on Windows:

```
npm install -g matterbridge --omit=dev
```

on Linux (if may need the necessary permissions):

```
sudo npm install -g matterbridge --omit=dev
```

See the complete guidelines on [Matterbridge](https://matterbridge.io) for more information.

### TaHoma bridge

A working setup of any of the TaHoma bridges (like the Connectivity kit).

## How to install

Open the frontend of matterbridge, select the plugin and install it.

## How to install from the command line

On windows:

```
cd $HOME\Matterbridge
npm install -g matterbridge-somfy-tahoma --omit=dev
matterbridge -add matterbridge-somfy-tahoma
```

On linux:

```
cd ~/Matterbridge
sudo npm install -g matterbridge-somfy-tahoma --omit=dev
matterbridge -add matterbridge-somfy-tahoma
```

Then start Matterbridge

```
matterbridge
```

## How to use it

You need to configure the service ("somfy_europe", "somfy_australia" or "somfy_north_america"), username and password of your Tahoma account.

If the whiteList is defined only the devices included are exposed to Matter.

If the blackList is defined the devices included will not be exposed to Matter.

If any device creates issues put it in the blackList.

Set for each device the full movement time (the plugin will use that time to syncronize the movement).

These are the config values:

```
{
  "name": "matterbridge-somfy-tahoma",
  "type": "DynamicPlatform",
  "username": "<USERNAME>",
  "password": "<PASSWORD>",
  "service": "somfy_europe",
  "blackList": [],
  "whiteList": [],
  "duration": {
    "<DEVICENAME1>": 30,
    "<DEVICENAME2>": 30
  }
}
```

You can edit the config file from the frontend (best option) or

On windows:

```
cd $HOME\.matterbridge
notepad matterbridge-somfy-tahoma.config.json
```

On linux:

```
cd ~/.matterbridge
nano matterbridge-somfy-tahoma.config.json
```

- You can then ask Siri

```
Siri open the Living room blind
Siri close the Living room blind
Siri set the Living room blind to 70%
```

## My position triggers

Somfy motors with electronic limits store a user-defined "favorite" position called **My**.
For every cover device that exposes a `my` (or `myPosition`) command, this plugin creates an
additional Matter OnOff bridged device alongside the cover. Tapping it sends the favorite
command to the motor and the switch resets itself to _off_ after ~1.5 s, so it acts as a
momentary trigger.

### When a device qualifies

A trigger device is created when:

- the cover passes the existing `whiteList` / `blackList` filter, **and**
- the underlying TaHoma device declares one of the commands `my`, `myPosition`, or `goToAlias`
  (the latter is typical for io-stack roller shutters that use named alias slots like
  `favorite1`).

If none of these is present, only the cover is exposed and a debug-level message is logged
explaining the skip.

### Configuration

```json
{
  "exposeMyPositionSwitch": true,
  "myPositionSuffix": "My",
  "myPositionAlias": "favorite1"
}
```

- `exposeMyPositionSwitch` (boolean, default `true`) — master switch for the feature.
- `myPositionSuffix` (string, default `"My"`) — appended to the cover label to name the trigger
  device. Pick a phrase that sounds natural in your locale and in voice commands, e.g.
  `Lieblingsposition`, `Tag-Stellung`, `Favorite`.
- `myPositionAlias` (string, default `"favorite1"`) — only used for io-stack devices that
  expose `goToAlias`. Identifies which alias slot holds your My-position; change to
  `favorite2` (etc.) if your favorite is stored on a different slot in the TaHoma app.

### Apple Home / Siri usage

After Matterbridge has paired with Apple Home, each compatible cover shows up twice: once as
the blind itself and once as the trigger switch. You can ask Siri:

> "Hey Siri, schalte Wohnzimmer Jalousie My ein"

and the motor will drive to its saved favorite position. The switch then turns off
automatically — no automation cleanup needed.

## Tilt control for venetian blinds

Somfy venetian blinds and exterior venetian blinds have two independent motions:
the **lift** (raising and lowering the whole blind) and the **tilt** (rotating
the lamellas). On supported devices this plugin exposes both as separate
controls so Apple Home, Google Home, and Alexa each render two sliders per
blind — "Position" and "Tilt".

### Which devices qualify

Tilt support is detected automatically. A cover gets the Matter `Tilt` feature
when its underlying TaHoma device advertises either of the Overkiz commands:

- `setOrientation` (preferred — typical for `ogp:VenetianBlind`, `ExteriorVenetianBlind`)
- `setTilt` (used by some IO-stack devices, e.g. `TiltOnlyVenetianBlindRTSComponent`)

Devices without either command keep the lift-only behaviour and look identical
to before.

If a cover also advertises `setClosure`, the plugin uses it to drive the lift
to an exact percentage in one shot instead of estimating motion time locally.

### How it appears in Apple Home

A tilt-capable venetian blind shows two sliders in the Home app:

- **Position** (0 % = open / blind raised, 100 % = closed / blind lowered)
- **Tilt** (0 % = lamellas open / horizontal, 100 % = lamellas closed / vertical)

Siri voice commands still work the way you expect:

> "Hey Siri, set the kitchen blind to 30 %"

operates the position only. For tilt, the easiest path is to add the blind to a
**scene** in the Home app and adjust both sliders there.

### Combining position and tilt in scenes

When you build an Apple Home scene that sets both the position and the tilt of
the same blind, Apple sends both updates almost simultaneously. To avoid the
well-known race where the second Overkiz command interrupts the first, this
plugin bundles them into a **single** Overkiz action with the commands in this
order:

1. `setClosure(int)` — move the blind to the requested position
2. `setOrientation(int)` (or `setTilt`) — rotate the lamellas

The Tahoma box then executes them sequentially without re-arbitration, so the
blind moves to position first and only then rotates the slats to the target
tilt — a single fluid motion.

Internally, lift and tilt commands arriving within a short window
(~500 ms) are coalesced into one action. Single-axis updates are dispatched
on their own with no extra latency for everyday slider drags.

### Configuration

```json
{
  "disableTilt": []
}
```

- `disableTilt` (array of device names, default `[]`) — listed devices are
  exposed as lift-only even if their command list advertises `setOrientation`
  or `setTilt`. Useful when auto-detection misfires for a specific motor.

No new credentials, services, or keys are required — tilt is purely a
capability detection refinement.

### Automatic tilt re-alignment after lift moves

Mechanically, a Somfy venetian-blind motor forces the lamellas to an extreme
angle whenever the lift moves (closed when raising, open when lowering). To
keep the physical tilt in sync with the Matter state, the plugin appends a
trailing `setOrientation(currentTilt)` command to every lift-only update.
Both commands ride in the same Overkiz `Action`, so Tahoma executes them
sequentially: the lift moves first, then the slats rotate back to the
previously stored tilt.

If the same update also carries an explicit tilt change (Apple Home scene,
simultaneous slider drag), the user-supplied tilt value is used instead and
no extra restore command is sent.

## Lift calibration

Different Somfy motors expose different mechanical end-stops on the Overkiz
API. One blind's "fully open" may be the Overkiz integer `23` and its "fully
closed" `85`; another `37` / `90`. Without calibration, the plugin maps
Matter `0%` → Overkiz `0` and `100%` → Overkiz `100`, which can leave the
blind short of its physical limit or attempt to drive past it.

The `liftCalibration` map remaps Matter `0..100%` linearly onto
`[top, bottom]` per device:

```json
{
  "liftCalibration": {
    "Küche": [23, 85],
    "Wohnzimmer": [37, 90]
  }
}
```

- `top` (integer `0..100`) — Overkiz value sent for Matter `0%` (fully open).
- `bottom` (integer `0..100`) — Overkiz value sent for Matter `100%` (fully
  closed). Must be strictly greater than `top`.

Devices without a calibration entry keep the identity mapping
(`0% → 0`, `100% → 100`).

Invalid entries (wrong array length, non-integer values, `top >= bottom`)
are logged as an error at startup and ignored — the affected device falls
back to identity mapping.
