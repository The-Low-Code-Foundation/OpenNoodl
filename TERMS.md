# NodeGX Alpha Terms

**Applies to:** NodeGX 0.1.0 (alpha), the desktop application.
**Last updated:** 2026-07-30.

NodeGX is free software distributed under the **GNU General Public License,
version 3**. The full text is in [`LICENSE`](./LICENSE), and it — not this file
— is what grants you the right to use, study, modify and redistribute the
software. Where anything below appears to conflict with the GPL, the GPL wins.

These terms cover the things the licence does not: what an alpha is, and what
you should expect from it.

---

## 1. This is an alpha

NodeGX 0.1.0 is a pre-release. It is offered so that people who are willing to
work on unfinished software can tell us what is broken.

Parts of it have never been used by anyone outside the project. Expect to find
bugs, missing features and rough edges — including in places where the software
looks finished.

## 2. No warranty

The software is provided **as is, without warranty of any kind**, express or
implied, including but not limited to the warranties of merchantability, fitness
for a particular purpose and non-infringement. This restates sections 15 and 16
of the GPL, which are the operative text.

You run it at your own risk. To the fullest extent permitted by law, the authors
and copyright holders are not liable for any claim, damages or other liability
arising from the software or its use.

## 3. Your data is not guaranteed to survive

**Back up your work. Keep your projects in version control.**

- **Projects may be lost or corrupted.** Alpha builds have defects, and some
  defects destroy data.
- **The project file format is not stable.** It will change between alpha
  versions. A project saved by a later version may not open in an earlier one.
- **Migration is best-effort.** Where a format change needs a migration, we will
  write one, and it may not be perfect. There is no promise that every project
  survives every upgrade intact.
- **Local backend data is not guaranteed either.** The database schema NodeGX's
  backend uses may change between alpha versions, and a migration may not
  preserve everything.
- **Uninstalling does not delete your data**, and installing a new version does
  not migrate it automatically. See the privacy policy for exactly where NodeGX
  keeps things on your disk.

If losing a piece of work would genuinely hurt, do not do that work in an alpha
without a backup you have tested.

## 4. Projects from Noodl will not reliably import

NodeGX is a fresh start rather than a continuation of Noodl. **Projects built in
Noodl 2.x, or in pre-revival OpenNoodl, are not guaranteed to import**, and some
will not import at all.

We promise the best import and conversion we can build, and nothing more. What
the importer cannot convert is either handed to the AI assistant to rebuild
inside the new project, or is left for you to rebuild by hand. Compatibility
with legacy projects is not a design constraint on NodeGX, and features are not
held back to protect them.

This is a deliberate decision, and it is recorded in full — with the reasoning —
in the project's compatibility policy. If your reason for installing NodeGX is
to recover an existing Noodl project, please read that first and set your
expectations accordingly.

## 5. What you build is yours

NodeGX claims nothing over the projects you create with it, the code it
generates for you, or the applications you ship. The GPL covers NodeGX itself;
it does not reach through the tool onto your work.

You are responsible for what you build — including for the data your application
collects from its own users, and for complying with whatever law applies to it.

## 6. AI features

The AI features are optional, off by default, and require an API key you supply.
When you use them, your requests go directly to the provider you chose, on your
own account and under **their** terms and pricing. We are not a party to that
relationship: we do not see your requests, we do not resell provider capacity,
and we do not reimburse provider charges.

Model output is not reviewed by us and is not guaranteed to be correct, secure
or fit for any purpose. Review what it produces before you rely on it —
particularly anything touching authentication, access control or payments.

The privacy policy sets out exactly what each AI feature transmits.

## 7. Third-party services

NodeGX connects to services operated by other people: GitHub, the AI provider
you configure, the documentation site, and the search service behind the help
box. Each is governed by its own terms and privacy policy. We do not control
them and are not responsible for them.

## 8. Third-party software

NodeGX includes open-source components under their own licences — MIT,
Apache-2.0, BSD-3-Clause, ISC and MPL-2.0 — all compatible with the GPLv3 the
product ships under. Library modules and prefabs you install from within the
editor carry their own licences and attribution, recorded with each module.

## 9. Support

There is none, in the contractual sense. There is a community, an issue tracker
and a small number of people who read it. Nothing here promises a response, a
fix, or a timeframe.

## 10. These terms will change

The alpha will change, and so will this file. It is versioned in the repository
next to the code it describes; its history is the change log. Continuing to use
a new version means accepting the terms shipped with it.

## 11. Contact

<!-- TODO(ALPHA-005): Richard to supply the publishing entity, governing law and
     a contact address before the first public build. Everything above is a
     statement about the software and is verified; this section is the only part
     awaiting a decision. -->

Questions about these terms should go to the project's issue tracker on GitHub.

---

**See also:** [`PRIVACY.md`](./PRIVACY.md) — what NodeGX does with your data,
written from the code · [`LICENSE`](./LICENSE) — GPL-3.0, the licence that
actually grants your rights.
