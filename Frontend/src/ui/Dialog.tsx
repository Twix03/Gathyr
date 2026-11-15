import * as RD from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './cn';

export function Dialog({ open, onOpenChange, title, description, children, className }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <RD.Content
          className={cn(
            'fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(440px,calc(100vw-32px))]',
            'max-h-[calc(100dvh-32px)] overflow-y-auto rounded-2xl bg-panel border border-line shadow-pop p-5 animate-pop-in',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <RD.Title className="font-display text-lg font-semibold">{title}</RD.Title>
              {description
                ? <RD.Description className="text-sm text-muted mt-1">{description}</RD.Description>
                : <RD.Description className="sr-only">{title}</RD.Description>}
            </div>
            <RD.Close className="p-1.5 -m-1.5 rounded-lg text-muted hover:text-text hover:bg-raised" aria-label="Close">
              <X size={18} />
            </RD.Close>
          </div>
          {children}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
