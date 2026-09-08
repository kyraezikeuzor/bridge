import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@omelora/sunrise";

type ReviewPagerProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
};

export function ReviewPager({
  page,
  pageCount,
  onPageChange,
}: ReviewPagerProps) {
  return (
    <div className="mt-4 flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        Page {page} of {pageCount}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Prev
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        >
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
