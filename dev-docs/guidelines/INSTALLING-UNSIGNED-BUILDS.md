# Installing NodeGX (unsigned builds)

NodeGX v0 is **not code-signed** — there is no paid Apple/Windows signing
certificate yet. The app is safe, but because it is unsigned each operating
system will warn you and make you take one deliberate step to open it the first
time. After that first launch it opens normally.

> This page is written for end users. Copy it into the GitHub Release
> description so anyone downloading a build knows how to open it. Maintainers:
> the signing story is in [RELEASE-PROCESS.md](./RELEASE-PROCESS.md).

---

## macOS

**Download:** `NodeGX-<version>-mac-universal.dmg` — one file, runs on both Apple
Silicon (M1/M2/M3/M4) and Intel Macs.

1. Open the `.dmg` and drag **NodeGX** into **Applications**.
2. The first time you open it, macOS will say NodeGX *"cannot be opened because
   Apple cannot check it for malicious software"* (or *"is damaged"* on the
   newest macOS). This is the unsigned warning, not a real problem.

**Easiest fix — Terminal (works on every macOS version):**

```bash
xattr -dr com.apple.quarantine /Applications/NodeGX.app
```

Then open NodeGX normally from Applications.

**Alternative — no Terminal (macOS 14 and earlier):**

- Right-click (or Control-click) **NodeGX** in Applications → **Open** →
  **Open** again in the dialog. macOS remembers the choice.
- Or: try to open it once, then go to **System Settings → Privacy & Security**,
  scroll down, and click **Open Anyway**.

> On macOS 15 (Sequoia) Apple removed the right-click bypass for unsigned apps,
> so the `xattr` command above is the reliable route there.

---

## Windows

**Download:** `NodeGX-<version>-win-x64.exe`.

1. Run the installer. Windows **SmartScreen** shows *"Windows protected your
   PC"*.
2. Click **More info**, then **Run anyway**.

That's it — the app installs and opens normally afterwards.

> This warning appears because the installer is unsigned (and, once signed, will
> still appear for a while until the certificate builds "reputation" through
> downloads). It is expected for a new app, not a sign of a problem.

---

## Linux

**Download:** `NodeGX-<version>-linux-x86_64.AppImage` (portable, no install) or
the `.deb` (Debian/Ubuntu).

### AppImage

```bash
chmod +x NodeGX-*-linux-x86_64.AppImage
./NodeGX-*-linux-x86_64.AppImage
```

If it complains about **FUSE**, either install it once:

```bash
sudo apt install libfuse2      # Debian/Ubuntu
```

…or run without FUSE:

```bash
./NodeGX-*-linux-x86_64.AppImage --appimage-extract-and-run
```

### .deb (Debian / Ubuntu)

```bash
sudo apt install ./NodeGX-*-linux-amd64.deb
```

Then launch **NodeGX** from your applications menu.

---

## Is this safe?

Yes. "Unsigned" only means the project has not (yet) paid for the certificates
that let Apple and Microsoft pre-verify the publisher. The warnings are the OS
being cautious about *any* unsigned app. If you would rather verify the download
yourself, each release lists SHA-512 checksums (in `latest*.yml`) you can check
against your downloaded file.
