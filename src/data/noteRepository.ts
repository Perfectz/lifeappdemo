import { createLocalRepository, type LocalRepository } from "@/data/createLocalRepository";
import type { Note } from "@/domain";
import { isNote } from "@/domain/notes";

const storageKey = "lifequest.notes.v1";

export type NoteRepository = LocalRepository<Note>;

export function createLocalNoteRepository(storage: Storage): NoteRepository {
  return createLocalRepository<Note>(storage, storageKey, isNote);
}

export const noteStorageKey = storageKey;
