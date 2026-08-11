/**
 * BST-001 — the store, or the reason there isn't one.
 *
 * `create_project` is the one tool in this server that takes no store: it writes
 * a project at a directory the caller names, which is by definition not the one
 * the server is pointed at. It was nonetheless unreachable, because
 * `new ProjectStore(dir)` ran before any registration and threw on anything that
 * was not already a v2 project. This class is what makes "started with nothing"
 * a state the server can be in rather than a startup failure.
 *
 * ## ⚠️ Why a handle, and not sixteen conditionals
 *
 * The instinct is to make each `register*Tools(rec, store, …)` call conditional
 * on there being a project. There are sixteen of them, and it is the wrong
 * shape: it makes the unbound surface a property of sixteen call sites, it means
 * a later bind (BST-002) has to re-run registration, and it guarantees one of
 * them is forgotten. So **everything is registered, always**, and the store sits
 * behind this handle. Three consequences worth having:
 *
 * 1. The refusal is written once — {@link NO_PROJECT_REFUSAL} — so it cannot
 *    drift between tools. That is the same argument `ProjectStore`'s own header
 *    makes about its two mirrored messages.
 * 2. A later bind touches **one object**, not a re-registration pass. BST-002
 *    adds a `bind()` here and nothing else changes shape.
 * 3. A tool that forgets to call {@link ProjectBinding.require} fails loudly the
 *    first time it dereferences nothing, rather than quietly reading a
 *    half-built store.
 *
 * ## ⚠️ `require()` is a request-time call
 *
 * Every one of the sixteen registration functions currently receives `store` as
 * an argument and closes over it. A registration function that resolves the
 * binding **when it registers** captures the unbound state forever — the tools
 * appear, and every one of them refuses even after a project exists. That is not
 * a hypothetical; it is the defect this design is shaped to prevent, and
 * `tests/projectBinding.test.ts` fails on it rather than letting it ship green.
 *
 * So: pass the *binding* where the store was passed, and call `require()` inside
 * the handler.
 *
 * @module noodl-mcp/project/ProjectBinding
 */

import { ToolError } from '../errors';
import { ProjectStore } from './ProjectStore';

/**
 * The one refusal, for every tool that needs a project on a server that has
 * none.
 *
 * ⚠️ **Written as an instruction, not as a diagnosis.** This string is read by a
 * model that has no other information about why its call failed. "No project
 * bound" produces a guess and a second wrong call; naming both exits produces
 * the next correct one. Every unbound-mode error in this server is held to that
 * bar.
 *
 * Exported so the suite asserts *from here* — a second copy of this sentence
 * anywhere else is the drift this class exists to prevent.
 */
export const NO_PROJECT_REFUSAL =
  'This server has no project bound, so there is nothing to read or change. Call list_projects to see the ' +
  'projects on this machine, or create_project to make a new one — then start a server with that directory ' +
  'as its argument to author in it.';

export class ProjectBinding {
  private store: ProjectStore | null;

  /**
   * `undefined` starts unbound. A directory is resolved immediately, so a bad
   * path still fails at startup with today's message rather than at the first
   * tool call — the bound path's behaviour is unchanged in every respect.
   */
  constructor(projectDir?: string) {
    this.store = projectDir === undefined ? null : new ProjectStore(projectDir);
  }

  /** Whether a project is bound. For the surface policy and the startup line. */
  get isBound(): boolean {
    return this.store !== null;
  }

  /**
   * The served project directory, or `undefined`. Read by the startup banner,
   * which must not print a directory the server does not have.
   */
  get projectDir(): string | undefined {
    return this.store?.projectDir;
  }

  /**
   * BST-002 — bind a project this server just created.
   *
   * ⚠️ **Bind once, and refuse the second.** A second `create_project` on a
   * bound server creates the project and does **not** repoint this one. An agent
   * tidying up mid-session would otherwise silently redirect every subsequent
   * tool at a different project, and nothing in any response says which project
   * it is describing — so the tools would keep working and start answering about
   * somewhere else. That is the boundary that keeps this from quietly becoming
   * a `use_project` contract, which the phase deliberately does not ship.
   *
   * @returns `true` when this call bound, `false` when a project was already
   *   bound and nothing changed. The caller says which happened; it is not
   *   something a reader of the result should have to infer.
   */
  bind(projectDir: string): boolean {
    if (this.store !== null) return false;
    // ⚠️ Constructed here rather than by the caller, so a directory the store
    // will not accept throws *before* anything is marked bound. A half-bound
    // server is the one state this class exists to make unrepresentable.
    this.store = new ProjectStore(projectDir);
    return true;
  }

  /**
   * The store, or a refusal that names the way out.
   *
   * ⚠️ Call this **inside the handler**, on every request. See the module
   * header: hoisting it into a registration closure is the defect this whole
   * shape exists to make impossible.
   */
  require(): ProjectStore {
    if (this.store === null) throw new ToolError('no-project', NO_PROJECT_REFUSAL);
    return this.store;
  }

  /**
   * The store if there is one, without throwing.
   *
   * For the handful of callers that legitimately want to know rather than to
   * act — the startup banner, and the suite. A tool handler wants
   * {@link require}: a tool that branches on absence is a tool writing its own
   * refusal, which is exactly what {@link NO_PROJECT_REFUSAL} is for.
   */
  peek(): ProjectStore | null {
    return this.store;
  }
}
