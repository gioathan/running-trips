"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { adminApiFetch, ApiError } from "@/lib/api";
import type { ContentPageAdmin, ContentSectionAdmin, SectionType } from "@/types/api";

type SectionData = Record<string, unknown>;

type SectionDraft = {
  id?: number;
  type: SectionType;
  enData: SectionData;
  elData: SectionData;
};

type ItemField = {
  path: (string | number)[];
  label: string;
  multiline?: boolean;
  options?: { value: string; label: string }[];
};

const SECTION_TYPES: { value: SectionType; label: string }[] = [
  { value: "hero", label: "Hero" },
  { value: "widget_list", label: "Widget list" },
  { value: "stats_band", label: "Stats band" },
  { value: "testimonials", label: "Testimonials" },
  { value: "faq", label: "FAQ" },
  { value: "comparison_table", label: "Comparison table" },
  { value: "steps", label: "Steps" },
  { value: "cta_banner", label: "CTA banner" },
  { value: "richtext", label: "Rich text" },
];

const PAGE_OPTIONS = [
  { value: "home", label: "Home" },
  { value: "services", label: "Services" },
  { value: "contact", label: "Contact" },
];

const FAQ_LAYOUTS = [
  { value: "accordion", label: "Accordion" },
  { value: "grid", label: "Grid" },
];

const STAT_CARD_VARIANTS = [
  { value: "light", label: "Light" },
  { value: "dark-highlight", label: "Dark highlight" },
];

function asData(value: unknown): SectionData {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as SectionData) : {};
}

function sectionToDraft(section: ContentSectionAdmin): SectionDraft {
  return {
    id: section.id,
    type: section.type,
    enData: { ...asData(section.translations.en) },
    elData: { ...asData(section.translations.el) },
  };
}

function draftsForPage(page: ContentPageAdmin): SectionDraft[] {
  return page.sections.map(sectionToDraft);
}

function defaultData(type: SectionType): SectionData {
  switch (type) {
    case "hero":
      return { headline: "", body: "" };
    case "widget_list":
      return { headline: "", items: [] };
    case "stats_band":
      return { items: [] };
    case "testimonials":
      return { headline: "", items: [] };
    case "faq":
      return { headline: "", layout: "accordion", items: [] };
    case "comparison_table":
      return { headline: "", columnLabels: ["On your own", "With us"], rows: [] };
    case "steps":
      return { headline: "", items: [] };
    case "cta_banner":
      return { headline: "" };
    case "richtext":
      return { html: "" };
  }
}

function emptySection(type: SectionType): SectionDraft {
  const data = defaultData(type);
  return { type, enData: structuredClone(data), elData: structuredClone(data) };
}

function readString(data: SectionData, key: string): string {
  const value = data[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function readItems(data: SectionData, key: string): SectionData[] {
  const value = data[key];
  return Array.isArray(value) ? value.map(asData) : [];
}

function readNestedString(item: SectionData, path: (string | number)[]): string {
  let value: unknown = item;
  for (const part of path) {
    if (value === null || typeof value !== "object") return "";
    value = (value as Record<string | number, unknown>)[part];
  }
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function updateNestedValue(item: SectionData, path: (string | number)[], nextValue: string): SectionData {
  const [key, ...remaining] = path;
  if (key === undefined) return item;
  if (remaining.length === 0) return { ...item, [key]: nextValue };

  const current = item[String(key)];
  const nested = Array.isArray(current) ? [...current] : [];
  const index = remaining[0];
  if (typeof index !== "number") return item;
  nested[index] = nextValue;
  return { ...item, [String(key)]: nested };
}

function FieldInput({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function FieldArea({ id, label, value, onChange, rows = 3 }: { id: string; label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function MiniWidgetFields({
  id,
  value,
  onChange,
}: {
  id: string;
  value: unknown;
  onChange: (value: SectionData | undefined) => void;
}) {
  const mini = asData(value);
  const kind = readString(mini, "kind");
  const options = [
    { value: "none", label: "None" },
    { value: "sparkline", label: "Sparkline" },
    { value: "progress", label: "Progress" },
    { value: "statGrid", label: "Stat grid" },
    { value: "badgeRow", label: "Badge row" },
  ];
  const selectKind = (nextKind: string) => {
    if (nextKind === "none") {
      onChange(undefined);
      return;
    }
    const defaults: Record<string, SectionData> = {
      sparkline: { kind: nextKind, label: "", seed: "" },
      progress: { kind: nextKind, label: "", value: "", percent: 0 },
      statGrid: { kind: nextKind, items: [] },
      badgeRow: { kind: nextKind, badges: [] },
    };
    onChange(defaults[nextKind]);
  };
  const update = (key: string, nextValue: unknown) => onChange({ ...mini, [key]: nextValue });

  return (
    <div className="rounded-md bg-surface-low p-3 sm:col-span-2">
      <Label htmlFor={`${id}-kind`}>Mini widget</Label>
      <Select id={`${id}-kind`} value={options.some((option) => option.value === kind) ? kind : "none"} onValueChange={selectKind} options={options} />
      {kind === "sparkline" && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <FieldInput id={`${id}-label`} label="Label" value={readString(mini, "label")} onChange={(next) => update("label", next)} />
          <FieldInput id={`${id}-seed`} label="Sparkline seed" value={readString(mini, "seed")} onChange={(next) => update("seed", next)} />
        </div>
      )}
      {kind === "progress" && (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <FieldInput id={`${id}-label`} label="Label" value={readString(mini, "label")} onChange={(next) => update("label", next)} />
          <FieldInput id={`${id}-value`} label="Value text" value={readString(mini, "value")} onChange={(next) => update("value", next)} />
          <div>
            <Label htmlFor={`${id}-percent`}>Percent</Label>
            <Input id={`${id}-percent`} type="number" min={0} max={100} value={readString(mini, "percent")} onChange={(event) => update("percent", Number(event.target.value))} />
          </div>
        </div>
      )}
      {kind === "statGrid" && (
        <div className="mt-3">
          <h5 className="text-label-sm uppercase text-ink-muted">Grid values</h5>
          {readItems(mini, "items").map((item, index) => (
            <div key={index} className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <FieldInput id={`${id}-stat-${index}-value`} label="Value" value={readString(item, "value")} onChange={(next) => update("items", readItems(mini, "items").map((row, rowIndex) => rowIndex === index ? { ...row, value: next } : row))} />
              <FieldInput id={`${id}-stat-${index}-label`} label="Label" value={readString(item, "label")} onChange={(next) => update("items", readItems(mini, "items").map((row, rowIndex) => rowIndex === index ? { ...row, label: next } : row))} />
              <button type="button" onClick={() => update("items", readItems(mini, "items").filter((_, rowIndex) => rowIndex !== index))} className="pb-2 text-body-sm text-error underline">Remove</button>
            </div>
          ))}
          <button type="button" onClick={() => update("items", [...readItems(mini, "items"), { value: "", label: "" }])} className="mt-2 text-body-sm text-primary underline">Add grid value</button>
        </div>
      )}
      {kind === "badgeRow" && (
        <div className="mt-3">
          <Label htmlFor={`${id}-badges`}>Badges, separated by commas</Label>
          <Input
            id={`${id}-badges`}
            value={Array.isArray(mini.badges) ? mini.badges.filter((badge): badge is string => typeof badge === "string").join(", ") : ""}
            onChange={(event) => update("badges", event.target.value.split(",").map((badge) => badge.trim()).filter(Boolean))}
          />
        </div>
      )}
    </div>
  );
}

function ItemList({
  id,
  label,
  items,
  fields,
  emptyItem,
  onChange,
  renderExtra,
}: {
  id: string;
  label: string;
  items: SectionData[];
  fields: ItemField[];
  emptyItem: SectionData;
  onChange: (items: SectionData[]) => void;
  renderExtra?: (item: SectionData, index: number, onChange: (item: SectionData) => void) => React.ReactNode;
}) {
  const changeItem = (itemIndex: number, path: (string | number)[], value: string) => {
    onChange(items.map((item, index) => (index === itemIndex ? updateNestedValue(item, path, value) : item)));
  };

  return (
    <div className="lg:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-label-md uppercase text-ink-muted">{label}</h4>
        <button type="button" onClick={() => onChange([...items, structuredClone(emptyItem)])} className="text-body-sm text-primary underline">
          Add item
        </button>
      </div>
      <div className="mt-3 divide-y divide-ink/10 border-y border-ink/10">
        {items.map((item, itemIndex) => (
          <div key={itemIndex} className="grid gap-3 py-4 sm:grid-cols-2">
            {fields.map((field) => {
              const fieldId = `${id}-${itemIndex}-${field.path.join("-")}`;
              const value = readNestedString(item, field.path);
              if (field.options) {
                return (
                  <div key={fieldId}>
                    <Label htmlFor={fieldId}>{field.label}</Label>
                    <Select
                      id={fieldId}
                      value={field.options.some((option) => option.value === value) ? value : field.options[0].value}
                      onValueChange={(nextValue) => changeItem(itemIndex, field.path, nextValue)}
                      options={field.options}
                    />
                  </div>
                );
              }
              if (field.multiline) {
                return <FieldArea key={fieldId} id={fieldId} label={field.label} value={value} onChange={(nextValue) => changeItem(itemIndex, field.path, nextValue)} />;
              }
              return <FieldInput key={fieldId} id={fieldId} label={field.label} value={value} onChange={(nextValue) => changeItem(itemIndex, field.path, nextValue)} />;
            })}
            {renderExtra?.(item, itemIndex, (updatedItem) => onChange(items.map((row, index) => index === itemIndex ? updatedItem : row)))}
            <div className="sm:col-span-2 sm:text-right">
              <button type="button" onClick={() => onChange(items.filter((_, index) => index !== itemIndex))} className="text-body-sm text-error underline">
                Remove item
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="py-4 text-body-sm text-ink-muted">No items.</p>}
      </div>
    </div>
  );
}

function CtaFields({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: unknown;
  onChange: (value: Record<string, string> | undefined) => void;
}) {
  const cta = asData(value);
  const enabled = Object.keys(cta).length > 0;
  return (
    <fieldset className="rounded-md border border-ink/10 p-4">
      <legend className="px-1 text-label-md uppercase text-ink-muted">{label}</legend>
      <label className="flex items-center gap-2 text-body-sm">
        <input type="checkbox" checked={enabled} onChange={(event) => onChange(event.target.checked ? { label: "", href: "" } : undefined)} />
        Show button
      </label>
      {enabled && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <FieldInput id={`${id}-label`} label="Button label" value={readString(cta, "label")} onChange={(nextValue) => onChange({ label: nextValue, href: readString(cta, "href") })} />
          <FieldInput id={`${id}-href`} label="Link" value={readString(cta, "href")} onChange={(nextValue) => onChange({ label: readString(cta, "label"), href: nextValue })} />
        </div>
      )}
    </fieldset>
  );
}

function TranslationFields({
  type,
  data,
  id,
  onChange,
}: {
  type: SectionType;
  data: SectionData;
  id: string;
  onChange: (data: SectionData) => void;
}) {
  const set = (key: string, value: unknown) => onChange({ ...data, [key]: value });
  const text = (key: string, label: string, multiline = false) => {
    const props = { id: `${id}-${key}`, label, value: readString(data, key), onChange: (value: string) => set(key, value) };
    return multiline ? <FieldArea {...props} /> : <FieldInput {...props} />;
  };
  const itemList = (key: string, label: string, fields: ItemField[], emptyItem: SectionData) => (
    <ItemList id={`${id}-${key}`} label={label} items={readItems(data, key)} fields={fields} emptyItem={emptyItem} onChange={(items) => set(key, items)} />
  );
  const eyebrowHeadlineBody = (
    <>
      {text("eyebrow", "Eyebrow")}
      {text("headline", "Headline")}
      {text("body", "Body", true)}
    </>
  );

  switch (type) {
    case "hero":
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          {eyebrowHeadlineBody}
          {text("imageUrl", "Image URL")}
          <CtaFields id={`${id}-primary`} label="Primary CTA" value={data.primaryCta} onChange={(value) => set("primaryCta", value)} />
          <CtaFields id={`${id}-secondary`} label="Secondary CTA" value={data.secondaryCta} onChange={(value) => set("secondaryCta", value)} />
          {itemList("stats", "Stats", [{ path: ["value"], label: "Value" }, { path: ["label"], label: "Label" }], { value: "", label: "" })}
          {itemList(
            "statCards",
            "Stat cards",
            [
              { path: ["title"], label: "Title" },
              { path: ["value"], label: "Value" },
              { path: ["badge"], label: "Badge" },
              { path: ["sublabel"], label: "Sublabel" },
              { path: ["variant"], label: "Style", options: STAT_CARD_VARIANTS },
            ],
            { title: "", value: "", variant: "light" }
          )}
        </div>
      );
    case "widget_list":
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          {eyebrowHeadlineBody}
          <ItemList
            id={`${id}-items`}
            label="Items"
            items={readItems(data, "items")}
            fields={[
              { path: ["numberLabel"], label: "Number" },
              { path: ["icon"], label: "Icon key" },
              { path: ["title"], label: "Title" },
              { path: ["body"], label: "Body", multiline: true },
            ]}
            emptyItem={{ title: "", body: "" }}
            onChange={(items) => set("items", items)}
            renderExtra={(item, itemIndex, onItemChange) => (
              <MiniWidgetFields
                key={`${id}-item-${itemIndex}-mini`}
                id={`${id}-item-${itemIndex}-mini`}
                value={item.mini}
                onChange={(mini) => onItemChange({ ...item, mini })}
              />
            )}
          />
        </div>
      );
    case "stats_band":
      return <div className="grid gap-4 sm:grid-cols-2">{itemList("items", "Stats", [{ path: ["value"], label: "Value" }, { path: ["label"], label: "Label" }], { value: "", label: "" })}</div>;
    case "testimonials":
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          {text("eyebrow", "Eyebrow")}
          {text("headline", "Headline")}
          {itemList(
            "items",
            "Testimonials",
            [
              { path: ["quote"], label: "Quote", multiline: true },
              { path: ["name"], label: "Name" },
              { path: ["role"], label: "Role" },
              { path: ["avatarUrl"], label: "Avatar URL" },
            ],
            { quote: "", name: "" }
          )}
        </div>
      );
    case "faq":
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          {text("eyebrow", "Eyebrow")}
          {text("headline", "Headline")}
          <div>
            <Label htmlFor={`${id}-layout`}>Layout</Label>
            <Select id={`${id}-layout`} value={readString(data, "layout") || "accordion"} onValueChange={(value) => set("layout", value)} options={FAQ_LAYOUTS} />
          </div>
          {itemList("items", "Questions", [{ path: ["question"], label: "Question" }, { path: ["answer"], label: "Answer", multiline: true }], { question: "", answer: "" })}
        </div>
      );
    case "comparison_table":
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          {text("headline", "Headline")}
          {[0, 1].map((column) => {
            const labels = Array.isArray(data.columnLabels) ? data.columnLabels : ["", ""];
            return (
              <FieldInput
                key={column}
                id={`${id}-column-${column}`}
                label={`Column ${column + 1} label`}
                value={typeof labels[column] === "string" ? labels[column] : ""}
                onChange={(value) => {
                  const nextLabels = [String(labels[0] ?? ""), String(labels[1] ?? "")];
                  nextLabels[column] = value;
                  set("columnLabels", nextLabels);
                }}
              />
            );
          })}
          {itemList(
            "rows",
            "Comparison rows",
            [
              { path: ["feature"], label: "Feature" },
              { path: ["values", 0], label: "First column" },
              { path: ["values", 1], label: "Second column" },
            ],
            { feature: "", values: ["", ""] }
          )}
        </div>
      );
    case "steps":
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          {text("eyebrow", "Eyebrow")}
          {text("headline", "Headline")}
          {itemList("items", "Steps", [{ path: ["title"], label: "Title" }, { path: ["body"], label: "Body", multiline: true }], { title: "", body: "" })}
        </div>
      );
    case "cta_banner":
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          {eyebrowHeadlineBody}
          <CtaFields id={`${id}-primary`} label="Primary CTA" value={data.primaryCta} onChange={(value) => set("primaryCta", value)} />
          <CtaFields id={`${id}-secondary`} label="Secondary CTA" value={data.secondaryCta} onChange={(value) => set("secondaryCta", value)} />
        </div>
      );
    case "richtext":
      return text("html", "HTML content", true);
  }
}

function TranslationPanel({
  label,
  type,
  data,
  id,
  onChange,
}: {
  label: string;
  type: SectionType;
  data: SectionData;
  id: string;
  onChange: (data: SectionData) => void;
}) {
  return (
    <section aria-label={`${label} section data`}>
      <h4 className="mb-4 text-label-md uppercase text-ink-muted">{label}</h4>
      <TranslationFields type={type} data={data} id={id} onChange={onChange} />
    </section>
  );
}

export function ContentPageEditor({ pages }: { pages: ContentPageAdmin[] }) {
  const router = useRouter();
  const [pageSlug, setPageSlug] = useState(pages[0]?.slug ?? "home");
  const [drafts, setDrafts] = useState<Record<string, SectionDraft[]>>(
    Object.fromEntries(pages.map((page) => [page.slug, draftsForPage(page)]))
  );
  const [newType, setNewType] = useState<SectionType>("hero");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const sections = drafts[pageSlug] ?? [];

  const updateSection = (index: number, changes: Partial<SectionDraft>) => {
    setDrafts((current) => ({
      ...current,
      [pageSlug]: (current[pageSlug] ?? []).map((section, sectionIndex) =>
        sectionIndex === index ? { ...section, ...changes } : section
      ),
    }));
    setSaved(false);
    setError(null);
  };

  const updateData = (index: number, locale: "en" | "el", data: SectionData) => {
    updateSection(index, locale === "en" ? { enData: data } : { elData: data });
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= sections.length) return;
    const nextSections = [...sections];
    [nextSections[index], nextSections[destination]] = [nextSections[destination], nextSections[index]];
    setDrafts((current) => ({ ...current, [pageSlug]: nextSections }));
    setSaved(false);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setBusy(true);

    try {
      const payloadSections = sections.map((section, index) => ({
        ...(section.id === undefined ? {} : { id: section.id }),
        type: section.type,
        sort_order: index,
        translations: [
          { locale: "en", data: section.enData },
          { locale: "el", data: section.elData },
        ],
      }));
      const updated = await adminApiFetch<ContentPageAdmin>(`/admin/content/pages/${pageSlug}`, {
        method: "PATCH",
        body: JSON.stringify({ sections: payloadSections }),
      });
      setDrafts((current) => ({ ...current, [pageSlug]: draftsForPage(updated) }));
      setSaved(true);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : "Could not save this page.");
    } finally {
      setBusy(false);
    }
  };

  const addSection = () => {
    setDrafts((current) => ({ ...current, [pageSlug]: [...(current[pageSlug] ?? []), emptySection(newType)] }));
    setSaved(false);
    setError(null);
  };

  const removeSection = (index: number) => {
    setDrafts((current) => ({ ...current, [pageSlug]: current[pageSlug].filter((_, i) => i !== index) }));
    setSaved(false);
    setError(null);
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-headline-lg">Content pages</h1>
          <p className="mt-2 text-body-md text-ink-muted">{pageSlug[0].toUpperCase() + pageSlug.slice(1)}</p>
        </div>
        <div className="w-48">
          <Label htmlFor="content-page">Page</Label>
          <Select
            id="content-page"
            value={pageSlug}
            onValueChange={(slug) => {
              setPageSlug(slug);
              setError(null);
              setSaved(false);
            }}
            options={PAGE_OPTIONS}
          />
        </div>
      </div>

      <form onSubmit={onSubmit}>
        <div className="mt-8 space-y-4">
          {sections.map((section, index) => (
            <Card key={section.id ?? `new-${index}`} className="p-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-label-sm uppercase text-ink-muted">Section {index + 1}</span>
                <div className="w-48">
                  <Select
                    value={section.type}
                    onValueChange={(type) => {
                      if (!window.confirm("Changing section type replaces its current fields.")) return;
                      const replacement = emptySection(type as SectionType);
                      updateSection(index, { type: replacement.type, enData: replacement.enData, elData: replacement.elData });
                    }}
                    options={SECTION_TYPES}
                  />
                </div>
                <div className="ml-auto flex gap-3">
                  <button type="button" onClick={() => moveSection(index, -1)} disabled={index === 0 || busy} className="text-body-sm underline disabled:opacity-40">
                    Move up
                  </button>
                  <button type="button" onClick={() => moveSection(index, 1)} disabled={index === sections.length - 1 || busy} className="text-body-sm underline disabled:opacity-40">
                    Move down
                  </button>
                  <button type="button" onClick={() => removeSection(index)} disabled={busy} className="text-body-sm text-error underline">
                    Remove
                  </button>
                </div>
              </div>
              <div className="mt-6 grid gap-8 xl:grid-cols-2">
                <TranslationPanel
                  label="English"
                  type={section.type}
                  data={section.enData}
                  id={`section-${index}-en`}
                  onChange={(data) => updateData(index, "en", data)}
                />
                <TranslationPanel
                  label="Greek"
                  type={section.type}
                  data={section.elData}
                  id={`section-${index}-el`}
                  onChange={(data) => updateData(index, "el", data)}
                />
              </div>
            </Card>
          ))}
          {sections.length === 0 && <p className="py-10 text-center text-body-md text-ink-muted">This page has no sections.</p>}
        </div>

        <div className="mt-6 flex flex-wrap items-end gap-3">
          <div className="w-48">
            <Label htmlFor="new-section-type">Add section type</Label>
            <Select id="new-section-type" value={newType} onValueChange={(type) => setNewType(type as SectionType)} options={SECTION_TYPES} />
          </div>
          <Button type="button" variant="secondary" onClick={addSection} disabled={busy}>
            Add section
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving..." : "Save page"}
          </Button>
          {saved && <span role="status" className="text-body-sm text-success">Saved</span>}
        </div>
        {error && <p role="alert" className="mt-4 text-body-sm text-error">{error}</p>}
      </form>
    </div>
  );
}