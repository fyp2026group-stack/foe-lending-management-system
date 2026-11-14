'use client';
import type { ReactNode } from 'react';
import { Tabs as TabsRoot, TabsList, TabsTrigger, TabsContent } from './tabs';
/** Application composition of the official shadcn/Radix tabs. */
export function Tabs({
  value,
  onValueChange,
  items,
  label,
  children,
  action,
}: {
  value: string;
  onValueChange: (value: string) => void;
  items: { value: string; label: string }[];
  label: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <TabsRoot value={value} onValueChange={onValueChange}>
      <div className="tabs-command">
        <TabsList aria-label={label} className="module-tabs">
          {items.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {action}
      </div>
      <TabsContent key={value} value={value}>
        {children}
      </TabsContent>
    </TabsRoot>
  );
}
