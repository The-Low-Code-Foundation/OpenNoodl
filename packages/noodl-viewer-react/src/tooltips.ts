/** One illustration in a port tooltip's image row. `src` is resolved relative to
 * `../assets/images/tooltips/`, so it is a bare file name, not a URL. */
export interface TooltipImage {
  src: string;
  label?: string;
  body?: string;
}

export interface TooltipSpec {
  title: string;
  /** A single paragraph, or several. */
  body?: string | string[];
  images?: TooltipImage[];
}

/**
 * Builds the HTML for a port's extended tooltip — the popup the editor shows for
 * `PortTooltip.extended`.
 *
 * The fields are interpolated raw, so this trusts its input. That is fine as it
 * stands: every call site passes literals authored in this repository.
 */
export function createTooltip({ title, body, images }: TooltipSpec): string {
  let html = `<h3>${title}</h3>`;
  if (body) {
    const paragraphs = Array.isArray(body) ? body : [body];

    html += paragraphs.map((text) => `<p>${text}</p>`).join('');
  }

  if (images) {
    let imgHtml = '';

    images.forEach((e) => {
      imgHtml += `<div class="popup-layer-image-item">`;
      imgHtml += `<img src="../assets/images/tooltips/${e.src}">`;
      if (e.label) {
        imgHtml += `<h3>${e.label}</h3>`;
      }
      if (e.body) {
        imgHtml += `<p>${e.body}</p>`;
      }
      imgHtml += `</div>`;
    });

    html += `<div class="popup-layer-image-row">${imgHtml}</div>`;
  }

  return html;
}
