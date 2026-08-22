# MapLibre GL

Interactive maps powered by [MapLibre GL JS](https://maplibre.org/) — the
open-source (BSD-3-Clause) fork of Mapbox GL. This module replaces the retired
Mapbox module: mapbox-gl v2+ is proprietary and cannot be redistributed;
MapLibre can, so the whole library (`maplibre-gl.js` 4.7.1 + its stylesheet +
its license) ships inside the module and nothing is fetched from a CDN at
runtime except map tiles.

## Zero configuration

Drop a **MapLibre Map** node into a visual tree and it renders a world map
immediately. The default style is the free, token-less MapLibre demo style:

```
https://demotiles.maplibre.org/style.json
```

No access token, no account, no project settings. (The retired Mapbox node
required a Mapbox access token in project settings — there is no equivalent
here and nothing to configure.)

## Pointing at other styles

Set the **Style** input to any MapLibre-compatible style JSON URL:

- Self-hosted or third-party styles: e.g. `https://tiles.openfreemap.org/styles/liberty`
  (OpenFreeMap, free), or a [Protomaps](https://protomaps.com/) style.
- Commercial tile providers (MapTiler, Stadia, Jawg, …) work too — their style
  URLs carry an API key as a query parameter, e.g.
  `https://api.maptiler.com/maps/streets/style.json?key=YOUR_KEY`.
- Any style JSON you host yourself, following the
  [MapLibre style spec](https://maplibre.org/maplibre-style-spec/).

Mind each tile provider's terms of use and attribution requirements; the map
shows the attribution control declared by the style.

## Ports

**Inputs** — Style (style JSON URL) · Interactive (boolean) · Geopoint (an
object `{ longitude, latitude }`, wins over the two number inputs when set) ·
Longitude / Latitude / Zoom / Bearing / Pitch (camera) · Markers (array).

**Outputs** — Map Object (the raw `maplibregl.Map` for Function nodes) ·
Camera Longitude / Latitude / Zoom / Bearing / Pitch (updated as the map
moves) · Map Loaded / Map Moved (signals) · Click + Clicked Longitude /
Latitude · Marker Clicked + Clicked Marker Index.

## Markers

Connect an array of objects to the **Markers** input; each item:

```json
{ "longitude": 11.97, "latitude": 57.71, "color": "tomato", "tooltip": "Göteborg" }
```

`color` and `tooltip` are optional — `tooltip` opens as a popup when the marker
is clicked, and any marker click also fires **Marker Clicked** with **Clicked
Marker Index** set. Items missing valid coordinates are skipped.

## Migrating from the Mapbox module

The port surface mirrors the old "Mapbox Map" node (Style, the Coordinates
group, click/moved/loaded events). Differences: no access token anywhere,
`mapbox://styles/...` URLs do not work (use a style JSON URL as above), and
markers are a data array on the map node rather than child Marker nodes.
