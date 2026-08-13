const View = require('../../../../shared/ListenableView').default;
const Config = require('../../../../shared/config/config');
const { ipcRenderer } = require('electron');

const remote = require('@electron/remote');

require('@noodl/platform-electron');
require('@noodl-core-ui/styles/custom-properties/colors.css');

const { platform, PlatformOS } = require('@noodl/platform');
const { CanvasView } = require('../../../../editor/src/views/VisualCanvas/CanvasView');
const { showContextMenuInPopup } = require('../../../../editor/src/views/ShowContextMenuInPopup');

const MenuDialogWidth = require('@noodl-core-ui/components/popups/MenuDialog');

class Viewer extends View {
  constructor() {
    super();

    // remote.getCurrentWindow().webContents.openDevTools();

    this.isWindows = platform.os === PlatformOS.Windows;

    this.canvasView = new CanvasView({
      onNavigationStateChanged: (state) => {
        ipcRenderer.send('viewer-navigation-state', state);
      }
    });

    ipcRenderer.on('viewer-refresh', () => {
      this.canvasView.refresh();
      ipcRenderer.send('viewer-refreshed');
    });

    ipcRenderer.on('viewer-focus', () => {
      const window = remote.getCurrentWindow();
      if (window && window.focusable) {
        window.focus();
      }
    });

    ipcRenderer.on('viewer-open-devtools', () => {
      this.canvasView.openDevTools();
    });

    ipcRenderer.on('viewer-select-node', (sender, nodeId) => {
      this.canvasView.setNodeSelected(nodeId);
    });

    ipcRenderer.on('viewer-set-zoom-factor', (sender, zf) => {
      this.canvasView.setZoomFactor(zf);
    });

    ipcRenderer.on('viewer-set-route', (sender, route) => {
      this.canvasView.setCurrentRoute(route);
    });

    ipcRenderer.on('viewer-set-inspect-mode', (sender, inspectMode) => {
      this.canvasView.setInspectMode(inspectMode);
    });

    // DES-001 — the design-mode toast, resolved to a label by the editor
    // window (it owns the project model) and shown here, where the click was.
    ipcRenderer.on('viewer-design-selection', (sender, label) => {
      this.canvasView.showDesignSelection(label);
    });

    ipcRenderer.on('viewer-set-viewport-size', (sender, viewportSize) => {
      this.canvasView.setViewportSize(viewportSize);
    });

    ipcRenderer.on('viewer-navigate-forward', (sender) => {
      this.canvasView.navigateForward();
    });

    ipcRenderer.on('viewer-navigate-back', (sender) => {
      this.canvasView.navigateBack();
    });

    ipcRenderer.on('viewer-capture-thumb', async ({ sender }) => {
      // Capture a snapshot of the viewer
      const image = await this.canvasView.captureThumbnail();

      if (image) {
        sender.send('viewer-capture-thumb-reply', image.toDataURL());
      }
    });

    ipcRenderer.on('viewer-show-inspect-menu', ({ sender }, listItems) => {
      const items = listItems.map((item) => ({
        label: item.label,
        onClick: () => {
          sender.send('viewer-inspect-node', item.nodeId);
        }
      }));
      showContextMenuInPopup({ title: 'Nodes behind cursor', items, width: MenuDialogWidth.Large });
    });
  }

  /**
   * Builds the viewer chrome: a title bar (the preview URL plus the pop-out and
   * attach icons) over the webview container.
   *
   * Replaces `templates/viewer.html` and the `View.bindView` call that parsed
   * it (PLAT-002 wave 5b). The template's only bindings were two `data-click`
   * attributes, now plain click listeners. The class names are load-bearing —
   * `assets/style.css` selects on all of them.
   */
  _buildChrome() {
    const container = document.createElement('div');
    container.className = 'container';

    const header = document.createElement('div');
    header.className = 'sidebar-panel-header';

    this.titleEl = document.createElement('div');
    this.titleEl.className = 'title weburl';
    this.titleEl.textContent = 'Viewer';
    this.titleEl.addEventListener('click', () => this.onTitleClicked());

    const spacer = document.createElement('div');
    spacer.style.flexGrow = '1';

    const iconContainer = (iconClass, onClick) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'icon-container';
      wrapper.addEventListener('click', onClick);

      const icon = document.createElement('div');
      icon.className = `titlebar-icon ${iconClass}`;
      wrapper.appendChild(icon);

      return wrapper;
    };

    header.append(
      this.titleEl,
      spacer,
      iconContainer('titlebar-icon-external', () => this.onTitleClicked()),
      iconContainer('titlebar-icon-close', () => this.onAttachIconClicked())
    );

    this.webviewContainer = document.createElement('div');
    this.webviewContainer.className = 'webview-container';

    container.append(header, this.webviewContainer);
    return container;
  }

  render() {
    const el = this._buildChrome();
    if (this.el) this.el.appendChild(el);
    else this.el = el;

    this.webviewContainer.appendChild(this.canvasView.render());

    //make sure webview is never blurred so keyboard shortcuts always work (the webview is sending key input to the editor)
    setTimeout(() => {
      //give react a chance to render before focusing the first time
      this.webviewContainer.querySelector('webview')?.focus();
    }, 100);

    // DEBT-010 decision: the blur→refocus binding that used to sit here is
    // deleted. It never took effect (the webview is not in the DOM on this
    // tick, so both the jQuery original and the converted version bound to
    // nothing), and turning a hard focus trap ON would be a UX change nobody
    // asked for — a webview that refuses to lose focus fights every other
    // panel. See PLAT-002 NOTES wave 5b for the discovery record.

    getLocalIPs((result) => {
      const ipAddress = result && result.length > 0 ? result[result.length - 1] : 'localhost';
      const protocol = process.env.ssl ? 'https://' : 'http://';
      const webUrl = `${protocol}${ipAddress}:${Config.PreviewServer.port}`;
      this.titleEl.textContent = webUrl;
      this.titleEl.setAttribute('href', webUrl);
    });

    this._blockClicksAfterMovingWindow();

    return this.el;
  }
  _blockClicksAfterMovingWindow() {
    remote.getCurrentWindow().on('moved', () => {
      this.blockNextClick = true;
    });

    document.addEventListener(
      'click',
      (e) => {
        if (this.blockNextClick) {
          e.stopPropagation();
          this.blockNextClick = false;
        }
      },
      true
    ); //capture phase
  }
  onAttachIconClicked() {
    ipcRenderer.send('viewer-attach');
  }
  onTitleClicked() {
    platform.openExternal(this.titleEl.textContent);
  }
}

function getLocalIPs(callback) {
  let ips = [];

  const RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;

  const pc = new RTCPeerConnection({
    // Don't specify any stun/turn servers, otherwise you will
    // also find your public IP addresses.
    iceServers: []
  });
  // Add a media line, this is needed to activate candidate gathering.
  pc.createDataChannel('');

  // onicecandidate is triggered whenever a candidate has been found.
  pc.onicecandidate = function (e) {
    if (!e.candidate) {
      // Candidate gathering completed.
      pc.close();
      callback(ips);
      return;
    }
    var ip = /^candidate:.+ (\S+) \d+ typ/.exec(e.candidate.candidate)[1];
    if (ips.indexOf(ip) === -1)
      // avoid duplicate entries (tcp/udp)
      ips.push(ip);
  };
  pc.createOffer(
    function (sdp) {
      pc.setLocalDescription(sdp);
    },
    function onerror() {}
  );
}

module.exports = Viewer;
