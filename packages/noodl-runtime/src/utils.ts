/**
 * The viewer installs this global before any node runs. It is declared locally rather
 * than in a global .d.ts because the runtime is framework-neutral: this is the only place
 * in the package that reaches for it, and only for the deploy-time base URL.
 */
declare const Noodl: { baseUrl?: string } | undefined;

//this just assumes the base url is '/' always
function getAbsoluteUrl(_url: unknown): string {
  //convert to string in case the _url is a Cloud File (which is an object with a custom toString())
  const url = String(_url);

  //only add a the base url if this is a local URL (e.g. not a https url or  base64 string)
  if (!url || url[0] === '/' || url.includes('://') || url.startsWith('data:')) {
    return url;
  }

  return (Noodl.baseUrl || '/') + url;
}

/**
 * Log an error thrown by the JavaScript nodes.
 */
function logJavaScriptNodeError(error: unknown): void {
  if (typeof error === 'string') {
    console.log('Error in JS node run code.', error);
  } else {
    const err = error as Error;
    console.log(
      'Error in JS node run code.',
      Object.getPrototypeOf(err).constructor.name + ': ' + err.message,
      err.stack
    );
  }
}

export = {
  getAbsoluteUrl,
  logJavaScriptNodeError
};
