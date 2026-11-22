"use client";

import { useState } from "react";
import { PanelState } from "@/components/panel-state";
import { STARTERS, type Notebook } from "@/lib/lab/th-bridge";
import { loadPyodideFromCdn } from "@/lib/lab/pyodide-loader";

export function LabNotebook() {
  const [notebook, setNotebook] = useState<Notebook>(STARTERS[0]);
  const [output, setOutput] = useState("Python is not loaded.");
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Starting Python downloads about 10 MB of Pyodide, numpy, and pandas from jsDelivr. It does not run until you press the button.</p>
      <div className="flex flex-wrap gap-2">
        {STARTERS.map((item) => (
          <button key={item.id} type="button" className="h-10 rounded-full px-3 text-xs" onClick={() => setNotebook(item)}>{item.title}</button>
        ))}
        <button
          type="button"
          className="h-10 rounded-full bg-foreground px-3 text-xs text-background"
          onClick={() => {
            setBusy(true);
            setOutput("Loading Pyodide…");
            void loadPyodideFromCdn()
              .then(async (pyodide) => {
                await pyodide.loadPackage(["numpy", "pandas"]);
                setOutput("Python is ready. Shift-Enter runs the cell.");
              })
              .catch((error: unknown) => setOutput(error instanceof Error ? error.message : "Python did not load."))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "Loading" : "Start Python"}
        </button>
      </div>
      {busy ? <PanelState kind="loading" detail="Downloading the Python runtime." /> : null}
      <textarea
        value={notebook.cells[0]}
        onChange={(event) => setNotebook({ ...notebook, cells: [event.target.value] })}
        className="min-h-40 w-full rounded-md border border-border bg-card p-3 font-mono text-sm"
        aria-label="Notebook cell"
      />
      <pre className="overflow-auto rounded-xl bg-card/80 p-3 text-xs">{output}</pre>
    </div>
  );
}
