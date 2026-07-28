/**
 * How an AI activity item is classified — it drives the accent colour and icon
 * treatment of the item in the AI chat panel.
 *
 * This is the sole survivor of `views/Clippy/ClippyCommandsMetadata.ts`. That
 * file also declared the slash-command tables (`/UI`, `/Image`, `/Function`,
 * `/Chart`, …) that drove Clippy's command popup; Clippy was removed in
 * `fb619b39` and nothing imported those tables afterwards, so they went with it.
 * The enum stayed because `AiActivityItem` and the AI chat panel both classify by
 * it.
 *
 * Kept as its own module rather than folded into `interfaces.ts`: an enum is a
 * runtime value, and `interfaces.ts` and `AiAssistantModel.ts` already import
 * each other for types. A value import across that pair would turn an erased
 * cycle into a real one.
 */
export enum PopupItemType {
  Visual = 'is-visual',
  Data = 'is-data',
  Custom = 'is-custom'
}
