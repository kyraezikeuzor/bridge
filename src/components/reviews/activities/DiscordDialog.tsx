import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@omelora/sunrise";
import { ReviewDialog } from "../shared/ReviewDialog";
import { createDiscordPost } from "./activity";
import type { ReviewActivity } from "./types";

export function DiscordDialog({ activity, onClose }: { activity: ReviewActivity; onClose: () => void }) {
  const [text, setText] = useState(() => createDiscordPost(activity));
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ReviewDialog
      title="Discord Post Preview"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" variant="primary" onClick={() => void copy()}>
            {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
            {copied ? "Copied!" : "Copy to Clipboard"}
          </Button>
        </div>
      }
    >
      <label htmlFor="discord-post" className="mb-2 block text-sm text-muted-foreground">Edit the text before copying.</label>
      <textarea id="discord-post" className="h-64 w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" value={text} onChange={(event) => setText(event.target.value)} />
    </ReviewDialog>
  );
}
