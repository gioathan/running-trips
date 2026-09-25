"use client";

import * as Accordion from "@radix-ui/react-accordion";

export interface FaqItem {
  question: string;
  answer: string;
}

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  return (
    <Accordion.Root type="single" collapsible className="divide-y divide-ink/10">
      {items.map((item, index) => (
        <Accordion.Item key={index} value={String(index)} className="py-[17px]">
          <Accordion.Header>
            <Accordion.Trigger className="flex w-full items-center justify-between text-left text-headline-sm">
              <span>{item.question}</span>
              <span aria-hidden className="ml-4 text-ink-muted">+</span>
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="pt-3 text-body-md text-ink-muted">{item.answer}</Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
