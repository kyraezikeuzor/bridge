import type { ReactNode } from "react";
import { X } from "lucide-react";

type ReviewDialogProps = {
  title: string;
  badges?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
};

export function ReviewDialog({
  title,
  badges,
  children,
  footer,
  onClose,
}: ReviewDialogProps) {
  return (
    <dialog
      open
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none items-center justify-center bg-black/40 p-4"
      onCancel={onClose}
    >
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-background text-foreground shadow-xl">
        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">{title}</h2>
            {badges ? <div className="mt-2 flex flex-wrap gap-2">{badges}</div> : null}
          </div>
          <button
            type="button"
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer}
      </div>
    </dialog>
  );
}
