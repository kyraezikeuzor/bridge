import { Search } from "lucide-react";
import { Input } from "@omelora/sunrise";

type Option = { value: string; label: string };

type ReviewToolbarProps = {
  options: readonly Option[];
  value: string;
  onValueChange: (value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  searchLabel: string;
};

export function ReviewToolbar({
  options,
  value,
  onValueChange,
  search,
  onSearchChange,
  searchLabel,
}: ReviewToolbarProps) {
  return (
    <div className="mb-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
      <div className="flex w-full rounded-lg bg-muted p-1 sm:w-auto">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onValueChange(option.value)}
            className={`flex-1 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors sm:flex-none ${
              value === option.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="relative w-full sm:w-56">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <label className="sr-only" htmlFor={searchLabel}>
          Search
        </label>
        <Input
          id={searchLabel}
          name={searchLabel}
          placeholder="Search..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="!h-11 !rounded-full !border-transparent !bg-muted !pl-11 focus-visible:!ring-[#09b5ff] focus-visible:!ring-offset-0"
        />
      </div>
    </div>
  );
}
