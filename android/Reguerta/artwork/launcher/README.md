# Launcher artwork source

`ic_launcher_monochrome.svg` preserves the five path strings and group transform
from the Android vector recorded at `ea367ac9`. Its black silhouette, transparent
holes, scale and placement are unchanged. It is a development master outside
`app/src/*/res`, so the long vector is not parsed on a device.

HU-090 exports the master directly at 108, 162, 216, 324 and 432 pixels, matching
108 dp in the five Android density buckets. The resulting lossless RGBA PNGs
are `app/src/main/res/drawable-*/ic_launcher_monochrome.png`. Their decoded
pixels matched an independent direct render of the original vector at each
target size. A white-background original/export comparison was visually
reviewed before adopting this fallback; the complex path could not be reduced
below lint's 3,000-character threshold without changing the artwork.

The reviewed export used Sharp 0.35.5, libvips 8.18.7 and librsvg 2.63.2.
These are optional development tools, not application or Gradle dependencies.
Supply a Sharp module from an external tooling installation and export to a
temporary directory first:

```bash
HU090_SHARP_MODULE=/path/to/tooling/node_modules/sharp \
  node artwork/launcher/render-monochrome.cjs /path/to/temporary-res
```

Run that command from `android/Reguerta`. Inspect the output and compare decoded
pixels before copying the five files into `app/src/main/res`. Different renderer
or PNG encoder versions can change bytes or edge antialiasing; record their
versions and do not assume visual or binary equivalence from command success.
The export never needs Firebase, credentials, an emulator or an app runtime.

Keep the live `mipmap-*/ic_launcher_foreground.webp` files in both main and Debug.
They deliberately differ: the main mark is green with transparency, and Debug
retains its yellow/orange identity. The adaptive XML definitions own masking,
background colors and the monochrome reference; the removed complete legacy
icon/round bitmaps are unnecessary for the app's API 29+ baseline.

Before accepting future artwork changes, check API 29/current launchers,
regular/round masks, themed icons, light/dark appearance and Debug/QA distinction.
Local raster comparisons do not replace Android/OEM launcher validation.
