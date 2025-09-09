# OpenNoodl

OpenNoodl is a fork of the original Noodl open source code under GPL-3.0 license. OpenNoodl / Noodl is a front end React app builder with a visual programming interface.

OpenNoodl will aim to stay entirely in sync with the original repository, including future updates to this repository. A roadmap for updates will be published soon.

# Installing OpenNoodl

## One-click install

* [OpenNoodl 1.1.0 for MacOS Intel](https://github.com/The-Low-Code-Foundation/OpenNoodl/releases/download/release/OpenNoodl.1.1.0.Apple.Intel.dmg)
* [OpenNoodl 1.1.0 for MacOS Silicon](https://github.com/The-Low-Code-Foundation/OpenNoodl/releases/download/release/OpenNoodl.1.1.0.Apple.Silicon.dmg)
* [OpenNoodl 1.1.0 for Windows](https://github.com/The-Low-Code-Foundation/OpenNoodl/releases/download/release/OpenNoodl.1.1.0.Windows.exe)

## Arch Linux

On Arch Linux, OpenNoodl can be installed [from the AUR](https://aur.archlinux.org/packages/opennoodl):
```
yay -S opennoodl
```

# Getting started

## Beginner resources

* [Tutorials and basic info](https://learn-noodl.com)
* [Resources and community components](https://the-low-code-foundation.fibery.io/invite/5NtlTThnCPh2vaAk)

## Integrated back-end

### Cloud hosted

OpenNoodl has native CRUD nodes that work with Parse Server backends. [OpenNoodl Hosting](https://opennoodl-hosting.com) provides free and paid Parse Server backends to help you get started.

### Self hosted

If you prefer self-hosting or a local backend, while still taking advantage of the native OpenNoodl CRUD nodes, check out the repositories of the original [Noodl Cloud Services backend](https://github.com/The-Low-Code-Foundation/opennoodl-cloudservice) (Parse and cloud functions), as well as the new [OpenNoodl Better Backend](https://github.com/The-Low-Code-Foundation/opennoodl-better-backend) (Parse and n8n).

## Building from source

See the original Noodl documentation below

# Contribution

We welcome contributions to OpenNoodl! To contribute:

1. **Fork the repository** and create your feature branch (`git checkout -b feature/my-feature`).
2. **Make your changes** and follow the existing code style.
3. **Test your changes** locally.
4. **Commit your changes** (`git commit -am 'Add new feature'`).
5. **Push to your branch** (`git push origin feature/my-feature`).
6. **Open a pull request** describing your changes.

See [CONTRIBUTING.md](CONTRIBUTING.md) for details and our code of conduct.

If you have questions, join our [community](https://the-low-code-foundation.fibery.io/invite/5NtlTThnCPh2vaAk) or open an issue.

# Noodl

[Noodl](https://noodl.net) is a low-code platform where designers and developers build custom applications and experiences. Designed as a visual programming environment, it aims to expedite your development process. It promotes the swift and efficient creation of applications, requiring minimal coding knowledge.

## Documentation
Documentation for how to use Noodl can be found here:
[https://noodlapp.github.io/noodl-docs/](https://noodlapp.github.io/noodl-docs/)

## Community
Main support channel is Discord: [https://www.noodl.net/community](https://www.noodl.net/community)

## Download releases
Pre-built binaries can be [downloaded from Github](https://github.com/noodlapp/noodl/releases)

## Note for users who are migrating from the deprecated closed source version
- [Migrating the project files and workspaces to a Git provider](https://noodlapp.github.io/noodl-docs/docs/guides/collaboration/migrating-from-noodl-hosted-git)
- [Migrate backend and database](https://noodlapp.github.io/noodl-docs/docs/guides/deploy/using-an-external-backend#migrating-from-a-noodl-cloud-service)
- [Self-host frontend](https://noodlapp.github.io/noodl-docs/docs/guides/deploy/hosting-frontend)

## Building from source

```bash
# Install all dependencies
$ npm install

# Start the Noodl Editor and build a production version of the cloud and react runtime (useful when running Noodl from source but want to deploy to production)
$ npm start

# Start the Noodl Editor and watch the filesystem for changes to the runtimes. Development versions of the runtimes, not meant for production (mostly due to source maps and file size)
# This is ideal for a quick workflow when doing changes on the runtimes.
$ npm run dev

# Start Noodl Editor test runner
$ npm run test:editor
```

## Licenses
This repository contains two different licenses for different parts of the Noodl platform.

- Components related to the editor, used to edit Noodl projects, are under GPLv3
- Components related to the end applications, used by the applications Noodl deploys, are under MIT

All of the source code of applications created with Noodl are under MIT. This means you can do project specific changes to the runtime without having to redistribute your changes.

Packaged licensed under MIT:
- `noodl-runtime`
- `noodl-viewer-cloud`
- `noodl-viewer-react`

You can find a MIT LICENSE file in each of these packages. The rest of the repository is licensed under GPLv3.
