import { ExternalLink } from "lucide-react";

export function SubmissionContent({ content }: { content: string }) {
  const match = content.match(/^(https?:\/\/\S+)\s*([\s\S]*)$/);
  const url = match?.[1];
  const body = (match?.[2] ?? content).trim();
  const label = url && url.length > 60 ? `${url.slice(0, 60)}…` : url;

  return (
    <div className="mt-2 space-y-1.5">
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          <span className="break-all">{label}</span>
        </a>
      ) : null}
      {body ? (
        <p className="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-sm leading-relaxed text-foreground">
          {body}
        </p>
      ) : null}
    </div>
  );
}
