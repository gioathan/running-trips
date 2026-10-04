"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AdminDataTable, type AdminColumn } from "@/components/admin/AdminDataTable";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { adminApiFetch, ApiError } from "@/lib/api";
import type { RaceCategoryAdmin } from "@/types/api";

interface CategoryValues {
  slug: string;
  en: string;
  el: string;
}

const EMPTY_VALUES: CategoryValues = { slug: "", en: "", el: "" };

function toValues(category: RaceCategoryAdmin): CategoryValues {
  return {
    slug: category.slug,
    en: category.translations.en ?? "",
    el: category.translations.el ?? "",
  };
}

export function RaceCategoryManager({ categories }: { categories: RaceCategoryAdmin[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<RaceCategoryAdmin | null>(null);
  const [creating, setCreating] = useState(false);
  const [values, setValues] = useState<CategoryValues>(EMPTY_VALUES);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const closeForm = () => {
    setCreating(false);
    setEditing(null);
    setValues(EMPTY_VALUES);
    setError(null);
  };

  const startCreate = () => {
    setEditing(null);
    setValues(EMPTY_VALUES);
    setError(null);
    setCreating(true);
  };

  const startEdit = (category: RaceCategoryAdmin) => {
    setCreating(false);
    setEditing(category);
    setValues(toValues(category));
    setError(null);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setBusy(true);

    const payload = {
      slug: values.slug.trim().toLowerCase(),
      translations: [
        { locale: "en", name: values.en.trim() },
        { locale: "el", name: values.el.trim() },
      ],
    };

    try {
      if (editing) {
        await adminApiFetch(`/admin/race-categories/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await adminApiFetch("/admin/race-categories", { method: "POST", body: JSON.stringify(payload) });
      }
      closeForm();
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Could not save race category.");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (category: RaceCategoryAdmin) => {
    if (!window.confirm(`Delete the "${category.slug}" race category?`)) return;
    setError(null);
    setBusy(true);
    try {
      await adminApiFetch(`/admin/race-categories/${category.id}`, { method: "DELETE" });
      if (editing?.id === category.id) closeForm();
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof ApiError ? deleteError.message : "Could not delete race category.");
    } finally {
      setBusy(false);
    }
  };

  const columns: AdminColumn<RaceCategoryAdmin>[] = [
    { header: "Slug", render: (category) => <span className="font-mono text-body-sm">{category.slug}</span> },
    { header: "Name (EN)", render: (category) => category.translations.en || "—" },
    { header: "Name (EL)", render: (category) => category.translations.el || "—" },
    {
      header: "Actions",
      render: (category) => (
        <div className="flex items-center gap-4 whitespace-nowrap">
          <button type="button" onClick={() => startEdit(category)} className="text-body-sm text-primary underline" disabled={busy}>
            Edit
          </button>
          <button type="button" onClick={() => onDelete(category)} className="text-body-sm text-error underline" disabled={busy}>
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-headline-lg">Race categories</h1>
          <p className="mt-2 text-body-md text-ink-muted">Manage race distances and their English and Greek names.</p>
        </div>
        {!creating && !editing && (
          <Button type="button" onClick={startCreate}>
            Add category
          </Button>
        )}
      </div>

      {(creating || editing) && (
        <Card className="mt-6 p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-headline-sm">{editing ? "Edit category" : "New category"}</h2>
            <button type="button" onClick={closeForm} className="text-body-sm text-ink-muted underline" disabled={busy}>
              Cancel
            </button>
          </div>
          <form onSubmit={onSubmit} className="mt-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="category-slug">Slug</Label>
                <Input
                  id="category-slug"
                  required
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  title="Use lowercase letters, numbers, and hyphens."
                  value={values.slug}
                  onChange={(event) => setValues({ ...values, slug: event.target.value })}
                  placeholder="half-marathon"
                />
              </div>
              <div>
                <Label htmlFor="category-name-en">Name (EN)</Label>
                <Input
                  id="category-name-en"
                  required
                  maxLength={100}
                  value={values.en}
                  onChange={(event) => setValues({ ...values, en: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="category-name-el">Name (EL)</Label>
                <Input
                  id="category-name-el"
                  required
                  maxLength={100}
                  value={values.el}
                  onChange={(event) => setValues({ ...values, el: event.target.value })}
                />
              </div>
            </div>
            {error && <p className="mt-3 text-body-sm text-error">{error}</p>}
            <div className="mt-5 flex gap-3">
              <Button type="submit" disabled={busy}>
                {busy ? "Saving..." : editing ? "Save changes" : "Create category"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {error && !creating && !editing && <p role="alert" className="mt-4 text-body-sm text-error">{error}</p>}
      <div className="mt-8">
        <AdminDataTable columns={columns} rows={categories} />
      </div>
    </div>
  );
}