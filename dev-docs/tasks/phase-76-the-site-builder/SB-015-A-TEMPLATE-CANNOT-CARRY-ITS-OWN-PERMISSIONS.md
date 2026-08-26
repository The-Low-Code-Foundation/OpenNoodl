# SB-015 — a template cannot carry the permissions its graphs assume

**Status: ⬜ OPEN. Derived s9 from the shipped defaults, not driven.** Filed rather than
absorbed because the fix is a mechanism nothing in this repository has, and which of the
three shapes it takes is a ruling.

---

## 1. The claim

SB-004 §4's security policy is what makes this template's publication boundary real:

```
Page, Section, Theme, SiteSettings   find/get: public   create/update/delete: role:admin
ContactMessage                       find/get/update: role:admin   create: nobody   delete: nobody
publishPage, duplicatePage           call: role:admin
submitContactForm                    call: public
claimSite                            call: authenticated
defaults.creatorOwns                 false
devOpen                              false
```

That is `security.json` in a **backend's data directory**. SB-007 ships a **project
directory**. There is no field in `project.json`, no file in the v2 layout, and no
mechanism in `provisionBackend` that carries a project's required policy to the backend
it provisions — `backendRequirementFor` is about *"this node needs a backend at all"*,
not about what that backend must permit.

So a person who picks Site Builder gets nineteen graphs that assume the table above, and
a backend that has none of it.

## 2. What they get instead, and it fails in two opposite ways

`defaultSecurityConfig()` (`packages/nodegx-backend/src/security/model.ts:282-301`):

```ts
devOpen: true,
defaults: { permissions: { find/get/create/update/delete: 'authenticated' }, creatorOwns: true },
collections: {}, functions: {},
```

**Locally, nothing is enforced.** `devOpenActive` is `devOpen && loopback`
(`state.ts:200-201`), and it disables row-level ACL entirely (`state.ts:286-287`). So on
the machine where the site is built, **every draft is visible to every anonymous
visitor** — the exact configuration SB-008 kept as its dev-open twin *because the same
draft renders in it*. The template appears to work and its one product does not.

**Deployed, nothing is visible.** A non-loopback bind with `devOpen: true` refuses to
start (`state.ts:182-188`), and its message says *set `devOpen: false` (then configure
collection permissions)*. Set it false with `collections: {}` and `Page.find` falls back
to the default — `authenticated` — so the public site serves nothing to the public. The
contact form's `create` is `authenticated` too, and `claimSite` has no `functions` rule.

🔴 **The two failure modes are opposite, and each looks like the other's fix.** Somebody
who hits the second and reaches for the first has turned the boundary off.

## 3. Three shapes, and the ruling is which

1. **The template ships a policy file and provisioning applies it.** A
   `nodegx.security.json` (or a `security` block in `nodegx.project.json`) written into
   the project by the template and read by `provisionBackend`. Most direct; adds a
   project-level artefact every existing project lacks, and a policy that travels with a
   *shared* project is a policy a recipient did not write.
2. **The permissions panel derives a proposal from the graph.** The information is
   there — every `Create Record`'s access rules, every `CloudFunction2`'s name — and the
   panel already knows the vocabulary (`ruleVocabulary.ts`). A button, not a file. Costs
   a derivation nobody has written and cannot be complete (a rule the graph never states
   cannot be derived).
3. **It stays manual and the template says so.** A `PROJECT.md` in the template naming
   the table in §1. Cheapest, and the one that is certainly not enough: the failure is
   silent in both directions and neither message points at permissions.

⚠️ **Whichever is chosen, the local case needs its own answer.** `devOpen: true` on a
fresh backend is a deliberate ease-of-start decision that predates this template, and it
is right for most projects. It is wrong for the only kind of project whose product is
*what a stranger cannot see* — and the template cannot tell.

## 4. What is measured and what is not

✅ **Read from source, cited**: the default config, `devOpenActive`'s effect, the
non-loopback refusal, the absence of any project→backend policy path.

⬜ **Not driven.** Nobody has created a project from this template, provisioned a
backend, and looked at what an anonymous visitor sees. That drive is the one that would
turn §2 from a derivation into a measurement, and it is the natural companion to SB-008 —
same instrument, one configuration difference, and it is the configuration a real first
user is in rather than the one every fixture is in. The same shape as SB-014's finding.
