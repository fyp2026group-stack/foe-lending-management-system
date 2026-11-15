'use client';
import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export type ReportOption = { value: string; label: string };
export function ReportRecordPicker({
  label,
  value,
  options,
  onChange,
  loading = false,
}: {
  label: string;
  value: string;
  options: ReportOption[];
  onChange: (value: string) => void;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const matches = useMemo(
    () => options.filter((option) => option.label.toLowerCase().includes(search.toLowerCase())).slice(0, 80),
    [options, search]
  );
  const selected = options.find((option) => option.value === value);
  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
    setSearch('');
  };
  return (
    <div className="admin-record-picker">
      <span className="admin-filter-label">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="admin-record-picker-trigger" aria-label={'Choose ' + label}>
            <span className="truncate">{selected?.label ?? (value ? 'Unknown selection' : 'All ' + label.toLowerCase())}</span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-55" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="admin-record-picker-menu">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={'Search ' + label.toLowerCase()}
            aria-label={'Search ' + label}
            autoFocus
          />
          <div className="admin-record-options" role="group" aria-label={label + ' choices'}>
            <button type="button" className="admin-record-option" onClick={() => choose('')}>
              All {label.toLowerCase()}
              {!value && <Check className="size-4" aria-hidden="true" />}
            </button>
            {matches.map((option) => (
              <button
                key={option.value}
                type="button"
                className="admin-record-option"
                onClick={() => choose(option.value)}
              >
                <span>{option.label}</span>
                {option.value === value && <Check className="size-4" aria-hidden="true" />}
              </button>
            ))}
            {!matches.length && <p className="text-sm text-muted-foreground p-3">{loading ? 'Loading choices…' : 'No matching choices.'}</p>}
            {options.length > 80 && matches.length === 80 && (
              <p className="text-xs text-muted-foreground p-2">Refine your search to view more choices.</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
