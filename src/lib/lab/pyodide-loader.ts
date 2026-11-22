export interface PyodideLike {
  runPythonAsync: (code: string) => Promise<unknown>;
  loadPackage: (names: string[]) => Promise<void>;
}

/** Loads Pyodide from jsDelivr only after the user asks. Tests pass a fake. */
export async function loadPyodideFromCdn(loader: (url: string) => Promise<PyodideLike> = defaultLoader): Promise<PyodideLike> {
  return loader("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");
}

async function defaultLoader(): Promise<PyodideLike> {
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Pyodide did not download."));
    document.head.appendChild(script);
  });
  const factory = (window as unknown as { loadPyodide?: (options: { indexURL: string }) => Promise<PyodideLike> }).loadPyodide;
  if (!factory) throw new Error("Pyodide did not start.");
  return factory({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/" });
}
