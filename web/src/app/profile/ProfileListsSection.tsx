"use client";

import {
  addMovieToList,
  createProfileList,
  deleteProfileList,
  removeMovieFromList,
  updateProfileList,
} from "@/app/actions/lists";
import { detailHrefFromStoredMovie, posterUrl } from "@/lib/tmdb/constants";
import TmdbImage from "@/components/ui/TmdbImage";
import Link from "next/link";
import { useState, useTransition } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ListMovie = {
  movie: {
    id: number;
    tmdb_id: number;
    title: string;
    poster_path: string | null;
    vote_count?: number | null;
  };
  position: number;
};

export type ProfileList = {
  id: string;
  name: string;
  emoji: string | null;
  description: string | null;
  is_public: boolean;
  position: number;
  movies: ListMovie[];
};

export type WatchedForPicker = {
  movie: {
    id: number;
    tmdb_id: number;
    title: string;
    poster_path: string | null;
  };
};

// ---------------------------------------------------------------------------
// Album cover — auto-collage from first 4 posters
// ---------------------------------------------------------------------------
function AlbumCover({ movies, name }: { movies: ListMovie[]; name: string }) {
  const posters = movies
    .slice()
    .sort((a, b) => a.position - b.position)
    .slice(0, 4)
    .map((m) => posterUrl(m.movie.poster_path, "w342"));

  if (posters.length === 0) {
    // Gradient placeholder with initial
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-900">
        <span className="text-3xl font-bold text-zinc-500 select-none">
          {name.slice(0, 1).toUpperCase()}
        </span>
      </div>
    );
  }

  if (posters.length === 1) {
    return (
      <div className="relative h-full w-full">
        {posters[0] ? (
          <TmdbImage src={posters[0]} alt={name} fill className="object-cover" sizes="200px" />
        ) : (
          <div className="h-full w-full bg-zinc-800" />
        )}
      </div>
    );
  }

  // 2×2 grid for 2–4 posters
  const slots = [0, 1, 2, 3];
  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-zinc-950">
      {slots.map((i) => {
        const src = posters[i] ?? null;
        return (
          <div key={i} className="relative overflow-hidden bg-zinc-800">
            {src ? (
              <TmdbImage src={src} alt="" fill className="object-cover" sizes="100px" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Movie Picker overlay
// ---------------------------------------------------------------------------
function MoviePicker({
  watched,
  alreadyIn,
  onAdd,
  onClose,
}: {
  watched: WatchedForPicker[];
  alreadyIn: Set<number>;
  onAdd: (movieId: number) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = watched.filter((w) =>
    search ? w.movie.title.toLowerCase().includes(search.toLowerCase()) : true,
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950/98 backdrop-blur-sm">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-sm text-zinc-300 hover:bg-zinc-700"
        >
          ✕
        </button>
        <h3 className="text-sm font-semibold text-white">Add films to list</h3>
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your films…"
          className="ml-auto w-52 rounded-full border border-white/10 bg-zinc-800 px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-zinc-500">No films found.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
            {filtered.map(({ movie }) => {
              const inList = alreadyIn.has(movie.id);
              const poster = posterUrl(movie.poster_path, "w342");
              return (
                <button
                  key={movie.id}
                  type="button"
                  disabled={inList}
                  onClick={() => !inList && onAdd(movie.id)}
                  title={movie.title}
                  className={`group relative aspect-[2/3] overflow-hidden rounded-lg transition ${
                    inList
                      ? "cursor-default opacity-35"
                      : "hover:ring-2 hover:ring-indigo-400"
                  }`}
                >
                  <div className="relative h-full w-full bg-zinc-800">
                    {poster ? (
                      <TmdbImage
                        src={poster}
                        alt={movie.title}
                        fill
                        className="object-cover"
                        sizes="(max-width:640px) 25vw, 12vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-1">
                        <span className="line-clamp-3 text-center text-[10px] text-zinc-500">
                          {movie.title}
                        </span>
                      </div>
                    )}
                    {inList ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <span className="text-xs font-medium text-white">✓ Added</span>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/40">
                        <span className="text-xl opacity-0 transition group-hover:opacity-100">＋</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create / Edit form
// ---------------------------------------------------------------------------
function ListForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: { name: string; description: string; is_public: boolean };
  onSave: (v: { name: string; description: string; is_public: boolean }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [desc, setDesc] = useState(initial?.description ?? "");
  const [isPublic, setIsPublic] = useState(initial?.is_public ?? true);

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="List name…"
        maxLength={60}
        autoFocus
        className="w-full rounded-xl border border-white/10 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
      />
      <textarea
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Description (optional)"
        maxLength={280}
        rows={2}
        className="w-full resize-none rounded-xl border border-white/10 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-400/30"
      />
      <div className="flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsPublic((v) => !v)}
            className={`relative h-5 w-9 rounded-full transition-colors focus:outline-none ${
              isPublic ? "bg-indigo-500" : "bg-zinc-600"
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                isPublic ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
          <span className="text-xs text-zinc-400">{isPublic ? "Public" : "Private"}</span>
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-white/10 px-4 py-1.5 text-xs text-zinc-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!name.trim() || saving}
            onClick={() => onSave({ name: name.trim(), description: desc.trim(), is_public: isPublic })}
            className="rounded-full bg-indigo-400 px-4 py-1.5 text-xs font-semibold text-black hover:bg-indigo-300 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail view for a single expanded list
// ---------------------------------------------------------------------------
function ListDetail({
  list,
  watched,
  onClose,
  onDelete,
  onUpdate,
  onAddMovie,
  onRemoveMovie,
}: {
  list: ProfileList;
  watched: WatchedForPicker[];
  onClose: () => void;
  onDelete: () => void;
  onUpdate: (v: { name: string; description: string; is_public: boolean }) => void;
  onAddMovie: (movieId: number) => void;
  onRemoveMovie: (movieId: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [isPending, startTransition] = useTransition();

  const inListIds = new Set(list.movies.map((m) => m.movie.id));
  const sorted = list.movies.slice().sort((a, b) => a.position - b.position);

  return (
    <>
      <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <button onClick={onClose} className="mb-2 text-xs text-zinc-500 hover:text-zinc-300">
              ← Back to lists
            </button>
            <h3 className="text-xl font-bold text-white">{list.name}</h3>
            {list.description && (
              <p className="mt-1 text-sm text-zinc-400">{list.description}</p>
            )}
            <p className="mt-1 text-xs text-zinc-600">
              {list.movies.length} film{list.movies.length !== 1 ? "s" : ""} ·{" "}
              {list.is_public ? "Public" : "Private"}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => setEditing((v) => !v)}
              className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
            >
              Edit
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete "${list.name}"?`)) onDelete();
              }}
              className="rounded-full border border-red-900/40 px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/20"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Edit form */}
        {editing && (
          <div className="mb-4">
            <ListForm
              initial={{ name: list.name, description: list.description ?? "", is_public: list.is_public }}
              onSave={(v) => {
                onUpdate(v);
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
              saving={isPending}
            />
          </div>
        )}

        {/* Add films button */}
        <button
          onClick={() => setShowPicker(true)}
          className="mb-4 rounded-full bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700"
        >
          + Add films
        </button>

        {/* Movie grid */}
        {sorted.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 py-10 text-center">
            <p className="text-sm text-zinc-500">No films in this list yet.</p>
            <button
              onClick={() => setShowPicker(true)}
              className="mt-3 text-xs text-indigo-300/70 hover:text-indigo-300"
            >
              Add your first film →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
            {sorted.map(({ movie }) => {
              const poster = posterUrl(movie.poster_path, "w342");
              const href = detailHrefFromStoredMovie(movie);
              return (
                <div key={movie.id} className="group relative">
                  <Link
                    href={href}
                    title={movie.title}
                    className="relative block aspect-[2/3] overflow-hidden rounded-lg bg-zinc-800"
                  >
                    {poster ? (
                      <TmdbImage
                        src={poster}
                        alt={movie.title}
                        fill
                        className="object-cover transition group-hover:scale-[1.03]"
                        sizes="(max-width:640px) 25vw, 12vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-1">
                        <span className="line-clamp-3 text-center text-[9px] text-zinc-500">
                          {movie.title}
                        </span>
                      </div>
                    )}
                  </Link>
                  <button
                    onClick={() => startTransition(() => onRemoveMovie(movie.id))}
                    title="Remove from list"
                    className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] text-white shadow group-hover:flex hover:bg-red-500"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showPicker && (
        <MoviePicker
          watched={watched}
          alreadyIn={inListIds}
          onAdd={(movieId) => {
            startTransition(() => onAddMovie(movieId));
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main section component
// ---------------------------------------------------------------------------
export function ProfileListsSection({
  initialLists,
  watched,
}: {
  initialLists: ProfileList[];
  watched: WatchedForPicker[];
}) {
  const [lists, setLists] = useState<ProfileList[]>(initialLists);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const selectedList = lists.find((l) => l.id === selectedId) ?? null;

  async function handleCreate(v: { name: string; description: string; is_public: boolean }) {
    setError(null);
    try {
      const id = await createProfileList({
        name: v.name,
        description: v.description || undefined,
        is_public: v.is_public,
      });
      const newList: ProfileList = {
        id,
        name: v.name,
        emoji: null,
        description: v.description || null,
        is_public: v.is_public,
        position: lists.length,
        movies: [],
      };
      startTransition(() => {
        setLists((prev) => [...prev, newList]);
        setCreating(false);
        setSelectedId(id);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create list.");
    }
  }

  async function handleDelete(listId: string) {
    setError(null);
    try {
      await deleteProfileList(listId);
      startTransition(() => {
        setLists((prev) => prev.filter((l) => l.id !== listId));
        setSelectedId(null);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete list.");
    }
  }

  async function handleUpdate(
    listId: string,
    v: { name: string; description: string; is_public: boolean },
  ) {
    setError(null);
    try {
      await updateProfileList(listId, {
        name: v.name,
        description: v.description || null,
        is_public: v.is_public,
      });
      startTransition(() =>
        setLists((prev) =>
          prev.map((l) =>
            l.id === listId
              ? { ...l, name: v.name, description: v.description || null, is_public: v.is_public }
              : l,
          ),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update list.");
    }
  }

  async function handleAddMovie(listId: string, movieId: number) {
    const film = watched.find((w) => w.movie.id === movieId);
    if (!film) return;
    setError(null);
    try {
      await addMovieToList(listId, movieId);
      startTransition(() =>
        setLists((prev) =>
          prev.map((l) => {
            if (l.id !== listId) return l;
            const entry = { movie: film.movie, position: l.movies.length };
            return { ...l, movies: [...l.movies, entry] };
          }),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add film.");
    }
  }

  async function handleRemoveMovie(listId: string, movieId: number) {
    setError(null);
    try {
      await removeMovieFromList(listId, movieId);
      startTransition(() =>
        setLists((prev) =>
          prev.map((l) => {
            if (l.id !== listId) return l;
            return { ...l, movies: l.movies.filter((m) => m.movie.id !== movieId) };
          }),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove film.");
    }
  }

  return (
    <section className="mb-12">
      {/* Section header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">My Lists</h2>
        {!selectedList && (
          <button
            onClick={() => { setCreating(true); setSelectedId(null); }}
            className="rounded-full bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700"
          >
            + New list
          </button>
        )}
      </div>

      {error && (
        <p className="mb-3 rounded-xl bg-red-900/30 px-4 py-2 text-xs text-red-300">{error}</p>
      )}

      {/* Create form */}
      {creating && !selectedList && (
        <div className="mb-5">
          <ListForm
            onSave={handleCreate}
            onCancel={() => setCreating(false)}
            saving={isPending}
          />
        </div>
      )}

      {/* Detail view */}
      {selectedList ? (
        <ListDetail
          list={selectedList}
          watched={watched}
          onClose={() => setSelectedId(null)}
          onDelete={() => handleDelete(selectedList.id)}
          onUpdate={(v) => handleUpdate(selectedList.id, v)}
          onAddMovie={(movieId) => handleAddMovie(selectedList.id, movieId)}
          onRemoveMovie={(movieId) => handleRemoveMovie(selectedList.id, movieId)}
        />
      ) : lists.length === 0 && !creating ? (
        /* Empty state */
        <div className="rounded-2xl border border-dashed border-white/15 bg-zinc-900/30 px-6 py-10 text-center">
          <p className="text-sm text-zinc-400">
            Create lists to organise your films — by director, mood, decade, or anything you like.
          </p>
          <button
            onClick={() => setCreating(true)}
            className="mt-4 inline-block rounded-full bg-indigo-400/15 px-4 py-2 text-sm font-medium text-indigo-300 hover:bg-indigo-400/25"
          >
            + Create your first list
          </button>
        </div>
      ) : (
        /* Album grid */
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {lists.map((list) => (
            <button
              key={list.id}
              type="button"
              onClick={() => setSelectedId(list.id)}
              className="group text-left"
            >
              {/* Cover */}
              <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-2xl bg-zinc-800 ring-1 ring-white/5 transition group-hover:ring-indigo-400/30">
                <AlbumCover movies={list.movies} name={list.name} />
                {/* Movie count badge */}
                {list.movies.length > 0 && (
                  <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                    {list.movies.length}
                  </span>
                )}
              </div>
              {/* Info */}
              <p className="truncate text-sm font-semibold text-white group-hover:text-indigo-200">
                {list.name}
              </p>
              <p className="text-xs text-zinc-500">
                {list.movies.length} film{list.movies.length !== 1 ? "s" : ""}
                {!list.is_public && " · Private"}
              </p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
