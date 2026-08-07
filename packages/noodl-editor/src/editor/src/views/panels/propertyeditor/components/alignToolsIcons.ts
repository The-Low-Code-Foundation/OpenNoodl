/** Generated from templates/propertyeditor/aligntools.html — the legacy align-icon set. */
export interface AlignIcon {
  comp: string;
  value: string;
  tooltip: string;
  /** which rotation class to apply when the layout direction is vertical */
  rotate: null | "rotate" | "rotate2";
  svg: string;
}

export const ALIGN_ICONS: AlignIcon[] = [
  {
    "comp": "vertical",
    "value": "bottom",
    "tooltip": "Vertical align bottom",
    "rotate": null,
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"white\" width=\"25px\" height=\"25px\"> <path d=\"M16 13h-3V3h-2v10H8l4 4 4-4zM4 19v2h16v-2H4z\" /></svg>"
  },
  {
    "comp": "vertical",
    "value": "center",
    "tooltip": "Vertical align center",
    "rotate": null,
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"white\" width=\"25px\" height=\"25px\"> <path d=\"M8 19h3v4h2v-4h3l-4-4-4 4zm8-14h-3V1h-2v4H8l4 4 4-4zM4 11v2h16v-2H4z\" /></svg>"
  },
  {
    "comp": "vertical",
    "value": "top",
    "tooltip": "Vertical align top",
    "rotate": null,
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"white\" width=\"25px\" height=\"25px\"> <path d=\"M8 11h3v10h2V11h3l-4-4-4 4zM4 3v2h16V3H4z\" /></svg>"
  },
  {
    "comp": "horizontal",
    "value": "left",
    "tooltip": "Horizontal align left",
    "rotate": null,
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" transform=\"rotate(90)\" viewBox=\"0 0 24 24\" fill=\"white\" width=\"25px\" height=\"25px\"> <path d=\"M16 13h-3V3h-2v10H8l4 4 4-4zM4 19v2h16v-2H4z\" /></svg>"
  },
  {
    "comp": "horizontal",
    "value": "center",
    "tooltip": "Horizontal align center",
    "rotate": null,
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" transform=\"rotate(90)\" viewBox=\"0 0 24 24\" fill=\"white\" width=\"25px\" height=\"25px\"> <path d=\"M8 19h3v4h2v-4h3l-4-4-4 4zm8-14h-3V1h-2v4H8l4 4 4-4zM4 11v2h16v-2H4z\" /></svg>"
  },
  {
    "comp": "horizontal",
    "value": "right",
    "tooltip": "Horizontal align right",
    "rotate": null,
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" transform=\"rotate(90)\" viewBox=\"0 0 24 24\" fill=\"white\" width=\"25px\" height=\"25px\"> <path d=\"M8 11h3v10h2V11h3l-4-4-4 4zM4 3v2h16V3H4z\" /></svg>"
  },
  {
    "comp": "justify",
    "value": "left",
    "tooltip": "Justify left",
    "rotate": null,
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"white\" width=\"25px\" height=\"25px\"><path d=\"M15 15H3v2h12v-2zm0-8H3v2h12V7zM3 13h18v-2H3v2zm0 8h18v-2H3v2zM3 3v2h18V3H3z\"/></svg>"
  },
  {
    "comp": "justify",
    "value": "center",
    "tooltip": "Justify center",
    "rotate": null,
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"white\" width=\"25px\" height=\"25px\"><path d=\"M7 15v2h10v-2H7zm-4 6h18v-2H3v2zm0-8h18v-2H3v2zm4-6v2h10V7H7zM3 3v2h18V3H3z\"/></svg>"
  },
  {
    "comp": "justify",
    "value": "right",
    "tooltip": "Justify right",
    "rotate": null,
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"white\" width=\"25px\" height=\"25px\"><path d=\"M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zM3 3v2h18V3H3z\"/></svg>"
  },
  {
    "comp": "align-items",
    "value": "flex-start",
    "tooltip": "Align items start",
    "rotate": "rotate2",
    "svg": "<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"white\" xmlns=\"http://www.w3.org/2000/svg\"> <path d=\"M3 8L3 6L21 6L21 8L3 8Z\" fill-opacity=\"0.5\"/> <rect x=\"7\" y=\"19\" width=\"10\" height=\"4\" transform=\"rotate(-90 7 19)\"/> <rect x=\"13\" y=\"17\" width=\"8\" height=\"4\" transform=\"rotate(-90 13 17)\"/> </svg>"
  },
  {
    "comp": "align-items",
    "value": "center",
    "tooltip": "Align items center",
    "rotate": "rotate",
    "svg": "<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"white\" xmlns=\"http://www.w3.org/2000/svg\"> <path d=\"M3 13L3 11L21 11L21 13L3 13Z\" fill-opacity=\"0.5\"/> <rect x=\"7\" y=\"17\" width=\"10\" height=\"4\" transform=\"rotate(-90 7 17)\"/> <rect x=\"13\" y=\"16\" width=\"8\" height=\"4\" transform=\"rotate(-90 13 16)\"/> </svg>"
  },
  {
    "comp": "align-items",
    "value": "flex-end",
    "tooltip": "Align items end",
    "rotate": "rotate2",
    "svg": "<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"white\" xmlns=\"http://www.w3.org/2000/svg\"> <path d=\"M21 16L21 18L3 18L3 16L21 16Z\" fill-opacity=\"0.5\"/> <rect x=\"17\" y=\"5\" width=\"10\" height=\"4\" transform=\"rotate(90 17 5)\"/> <rect x=\"11\" y=\"7\" width=\"8\" height=\"4\" transform=\"rotate(90 11 7)\"/> </svg>"
  },
  {
    "comp": "justify-content",
    "value": "flex-start",
    "tooltip": "Justify content start",
    "rotate": "rotate",
    "svg": "<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"white\" xmlns=\"http://www.w3.org/2000/svg\"> <path d=\"M3 21L1 21L0.999998 3L3 3L3 21Z\" fill-opacity=\"0.5\"/> <rect x=\"4\" y=\"17\" width=\"10\" height=\"4\" transform=\"rotate(-90 4 17)\"/> <rect x=\"10\" y=\"17\" width=\"10\" height=\"4\" transform=\"rotate(-90 10 17)\"/> </svg>"
  },
  {
    "comp": "justify-content",
    "value": "center",
    "tooltip": "Justify content center",
    "rotate": "rotate",
    "svg": "<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"white\" xmlns=\"http://www.w3.org/2000/svg\"> <path d=\"M11 3H13V21H11V3Z\" fill-opacity=\"0.5\"/> <rect x=\"19\" y=\"7\" width=\"10\" height=\"4\" transform=\"rotate(90 19 7)\"/> <rect x=\"9\" y=\"7\" width=\"10\" height=\"4\" transform=\"rotate(90 9 7)\"/> </svg>"
  },
  {
    "comp": "justify-content",
    "value": "flex-end",
    "tooltip": "Justify content end",
    "rotate": "rotate",
    "svg": "<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"white\" xmlns=\"http://www.w3.org/2000/svg\"> <path d=\"M21 3H23V21H21V3Z\" fill-opacity=\"0.5\"/> <rect x=\"20\" y=\"7\" width=\"10\" height=\"4\" transform=\"rotate(90 20 7)\"/> <rect x=\"14\" y=\"7\" width=\"10\" height=\"4\" transform=\"rotate(90 14 7)\"/> </svg>"
  },
  {
    "comp": "justify-content",
    "value": "space-between",
    "tooltip": "Justify content space between",
    "rotate": "rotate",
    "svg": "<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"white\" xmlns=\"http://www.w3.org/2000/svg\"> <path d=\"M3 21L1 21L0.999998 3L3 3L3 21Z\" fill-opacity=\"0.5\"/> <path d=\"M23 21L21 21L21 3L23 3L23 21Z\" fill-opacity=\"0.5\"/> <rect x=\"4\" y=\"17\" width=\"10\" height=\"4\" transform=\"rotate(-90 4 17)\"/> <rect x=\"16\" y=\"17\" width=\"10\" height=\"4\" transform=\"rotate(-90 16 17)\"/> </svg>"
  },
  {
    "comp": "justify-content",
    "value": "space-around",
    "tooltip": "Justify content space around",
    "rotate": "rotate",
    "svg": "<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"white\" xmlns=\"http://www.w3.org/2000/svg\"> <path d=\"M3 21L1 21L0.999998 3L3 3L3 21Z\" fill-opacity=\"0.5\"/> <path d=\"M23 21L21 21L21 3L23 3L23 21Z\" fill-opacity=\"0.5\"/> <rect x=\"6\" y=\"17\" width=\"10\" height=\"4\" transform=\"rotate(-90 6 17)\"/> <rect x=\"14\" y=\"17\" width=\"10\" height=\"4\" transform=\"rotate(-90 14 17)\"/> </svg>"
  },
  {
    "comp": "justify-content",
    "value": "space-evenly",
    "tooltip": "Justify content space evenly",
    "rotate": "rotate",
    "svg": "<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"white\" xmlns=\"http://www.w3.org/2000/svg\"> <path d=\"M3 21L1 21L0.999998 3L3 3L3 21Z\" fill-opacity=\"0.5\"/> <path d=\"M13 21L11 21L11 3L13 3L13 21Z\" fill-opacity=\"0.5\"/> <path d=\"M23 21L21 21L21 3L23 3L23 21Z\" fill-opacity=\"0.5\"/> <rect x=\"5\" y=\"17\" width=\"10\" height=\"4\" transform=\"rotate(-90 5 17)\"/> <rect x=\"15\" y=\"17\" width=\"10\" height=\"4\" transform=\"rotate(-90 15 17)\"/> </svg>"
  },
  {
    "comp": "align-content",
    "value": "flex-start",
    "tooltip": "Align content start",
    "rotate": "rotate2",
    "svg": "<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"white\" xmlns=\"http://www.w3.org/2000/svg\"> <path d=\"M3 3L3 1L21 0.999999L21 3L3 3Z\" fill-opacity=\"0.5\"/> <rect x=\"7\" y=\"4\" width=\"10\" height=\"4\"/> <rect x=\"7\" y=\"10\" width=\"10\" height=\"4\"/> </svg>"
  },
  {
    "comp": "align-content",
    "value": "center",
    "tooltip": "Align content center",
    "rotate": "rotate",
    "svg": "<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"white\" xmlns=\"http://www.w3.org/2000/svg\"> <path d=\"M21 11L21 13L3 13L3 11L21 11Z\" fill-opacity=\"0.5\"/> <rect x=\"17\" y=\"19\" width=\"10\" height=\"4\" transform=\"rotate(180 17 19)\"/> <rect x=\"17\" y=\"9\" width=\"10\" height=\"4\" transform=\"rotate(180 17 9)\"/> </svg>"
  },
  {
    "comp": "align-content",
    "value": "flex-end",
    "tooltip": "Align content end",
    "rotate": "rotate2",
    "svg": "<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"white\" xmlns=\"http://www.w3.org/2000/svg\"> <path d=\"M21 21L21 23L3 23L3 21L21 21Z\" fill-opacity=\"0.5\"/> <rect x=\"17\" y=\"20\" width=\"10\" height=\"4\" transform=\"rotate(180 17 20)\"/> <rect x=\"17\" y=\"14\" width=\"10\" height=\"4\" transform=\"rotate(180 17 14)\"/> </svg>"
  },
  {
    "comp": "align-content",
    "value": "space-between",
    "tooltip": "Align content between",
    "rotate": "rotate",
    "svg": "<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"white\" xmlns=\"http://www.w3.org/2000/svg\"> <path d=\"M3 3L3 1L21 0.999999L21 3L3 3Z\" fill-opacity=\"0.5\"/> <path d=\"M3 23L3 21L21 21L21 23L3 23Z\" fill-opacity=\"0.5\"/> <rect x=\"7\" y=\"4\" width=\"10\" height=\"4\"/> <rect x=\"7\" y=\"16\" width=\"10\" height=\"4\"/> </svg>"
  },
  {
    "comp": "align-content",
    "value": "space-around",
    "tooltip": "Align content around",
    "rotate": "rotate",
    "svg": "<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"white\" xmlns=\"http://www.w3.org/2000/svg\"> <path d=\"M3 3L3 1L21 0.999999L21 3L3 3Z\" fill-opacity=\"0.5\"/> <path d=\"M3 13L3 11L21 11L21 13L3 13Z\" fill-opacity=\"0.5\"/> <path d=\"M3 23L3 21L21 21L21 23L3 23Z\" fill-opacity=\"0.5\"/> <rect x=\"7\" y=\"5\" width=\"10\" height=\"4\"/> <rect x=\"7\" y=\"15\" width=\"10\" height=\"4\"/> </svg>"
  },
  {
    "comp": "align-content",
    "value": "space-evenly",
    "tooltip": "Align content evenly",
    "rotate": "rotate",
    "svg": "<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"white\" xmlns=\"http://www.w3.org/2000/svg\"> <path d=\"M3 3L3 1L21 0.999999L21 3L3 3Z\" fill-opacity=\"0.5\"/> <path d=\"M3 23L3 21L21 21L21 23L3 23Z\" fill-opacity=\"0.5\"/> <rect x=\"7\" y=\"4\" width=\"10\" height=\"7\"/> <rect x=\"7\" y=\"13\" width=\"10\" height=\"7\"/> </svg>"
  }
];
