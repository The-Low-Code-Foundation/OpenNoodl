//used to optimize warnings so we're not sending unneccessary warnings.
//Improves editor performance, especially in larger projects

/**
 * The warnings currently believed to be live on one node, keyed by the caller's warning key.
 * A warning is an opaque payload as far as this class is concerned — it only ever compares
 * identity, never reads inside.
 */
type WarningsByKey = Record<string, unknown>;

class ActiveWarnings {
  currentWarnings: Map<string, WarningsByKey>;

  constructor() {
    this.currentWarnings = new Map();
  }

  /** @returns whether the caller should actually send this warning to the editor. */
  setWarning(nodeId: string, key: string, warning: unknown): boolean {
    //Check if we've already sent this warning
    if (this.currentWarnings.has(nodeId)) {
      //we have sent warnings to this node before, check if we've sent this particular one before
      const warningKeys = this.currentWarnings.get(nodeId);
      if (warningKeys[key] === warning) {
        //we've already sent this warning, no need to send it again
        return false;
      }

      //new warning, remember that we sent it
      warningKeys[key] = warning;
      return true;
    } else {
      //new warning, we havent sent any warnings to this node before
      //Remember that we sent it
      this.currentWarnings.set(nodeId, { [key]: warning });
      return true;
    }
  }

  /** @returns whether the caller should actually tell the editor to clear this warning. */
  clearWarning(nodeId: string, key: string): boolean {
    const warningKeys = this.currentWarnings.get(nodeId);

    if (!warningKeys || !warningKeys[key]) {
      //There are no warnings that we've sent on this node.
      //Save some performance by not sending an uneccesary message to the editor
      return false;
    }

    delete warningKeys[key];
    if (Object.keys(warningKeys).length === 0) {
      // Behaviour-preserving: this line read `delete this.currentWarnings.delete(nodeId)`.
      // `delete` on a call expression evaluates the call — so the entry *was* removed — and
      // then returns `true` because the operand is not a reference. The keyword was inert;
      // dropping it changes nothing at runtime and lets the line say what it does.
      this.currentWarnings.delete(nodeId);
    }

    return true;
  }

  /** @returns whether the node had any warnings worth telling the editor about. */
  clearWarnings(nodeId: string): boolean {
    if (this.currentWarnings.has(nodeId) === false) {
      //no warnings on this node, save some performance by not sending a message to the editor
      return false;
    }

    //no warnings for this node anymore
    this.currentWarnings.delete(nodeId);
    return true;
  }
}

export = ActiveWarnings;
