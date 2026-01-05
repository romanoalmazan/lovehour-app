import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  arrayRemove,
  Timestamp,
} from 'firebase/firestore';
import { db, ensureFirestoreNetwork } from '../config/firebase';

/**
 * Ensure Firestore is ready for operations
 */
const ensureFirestoreReady = async (): Promise<void> => {
  await ensureFirestoreNetwork();
};

export interface SharedNote {
  id: string;
  title: string;
  content: string;
  createdAt: any;
  updatedAt: any;
  createdBy: string;
  updatedBy: string;
}

export interface SharedNotesData {
  notes: SharedNote[];
  updatedAt: any;
}

const MAX_NOTES = 10;

/**
 * Generate a consistent document ID for shared notes between two users
 * Uses sorted user IDs to ensure same ID regardless of which user calls it
 */
export const getSharedNotesId = (uid1: string, uid2: string): string => {
  const sortedIds = [uid1, uid2].sort();
  return `${sortedIds[0]}_${sortedIds[1]}`;
};

/**
 * Generate a unique note ID
 */
const generateNoteId = (): string => {
  return `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Subscribe to shared notes changes in real-time
 * Returns an unsubscribe function
 */
export const subscribeToSharedNotes = (
  uid1: string,
  uid2: string,
  callback: (notes: SharedNote[]) => void
): (() => void) => {
  const notesId = getSharedNotesId(uid1, uid2);
  const notesRef = doc(db, 'sharedNotes', notesId);

  const unsubscribe = onSnapshot(
    notesRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as SharedNotesData;
        callback(data.notes || []);
      } else {
        // Document doesn't exist yet, return empty array
        callback([]);
      }
    },
    (error) => {
      console.error('Error subscribing to shared notes:', error);
      // On error, still call callback with empty array to prevent UI blocking
      callback([]);
    }
  );

  return unsubscribe;
};

/**
 * Create a new shared note
 */
export const createSharedNote = async (
  uid1: string,
  uid2: string,
  title: string,
  content: string,
  createdBy: string
): Promise<{ success: boolean; noteId?: string; error?: string }> => {
  try {
    await ensureFirestoreReady();

    const notesId = getSharedNotesId(uid1, uid2);
    const notesRef = doc(db, 'sharedNotes', notesId);

    // Check if document exists and get current notes
    const notesSnap = await getDoc(notesRef);
    const existingData = notesSnap.exists()
      ? (notesSnap.data() as SharedNotesData)
      : { notes: [] };

    // Check note limit
    if (existingData.notes.length >= MAX_NOTES) {
      return {
        success: false,
        error: `Maximum of ${MAX_NOTES} notes allowed`,
      };
    }

    // Validate title
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      return {
        success: false,
        error: 'Note title cannot be empty',
      };
    }

    if (trimmedTitle.length > 50) {
      return {
        success: false,
        error: 'Note title must be 50 characters or less',
      };
    }

    // Create new note
    // Use Timestamp.now() instead of serverTimestamp() for fields inside arrays
    const now = Timestamp.now();
    const newNote: SharedNote = {
      id: generateNoteId(),
      title: trimmedTitle,
      content: content || '',
      createdAt: now,
      updatedAt: now,
      createdBy,
      updatedBy: createdBy,
    };

    const updatedNotes = [...existingData.notes, newNote];

    if (notesSnap.exists()) {
      // Update existing document
      await updateDoc(notesRef, {
        notes: updatedNotes,
        updatedAt: serverTimestamp(),
      });
    } else {
      // Create new document
      await setDoc(notesRef, {
        notes: updatedNotes,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
    }

    return { success: true, noteId: newNote.id };
  } catch (error: any) {
    console.error('Error creating shared note:', error);
    return {
      success: false,
      error: error.message || 'Failed to create note',
    };
  }
};

/**
 * Update a specific shared note
 */
export const updateSharedNote = async (
  uid1: string,
  uid2: string,
  noteId: string,
  updates: { title?: string; content?: string },
  updatedBy: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    await ensureFirestoreReady();

    const notesId = getSharedNotesId(uid1, uid2);
    const notesRef = doc(db, 'sharedNotes', notesId);

    // Get current notes
    const notesSnap = await getDoc(notesRef);
    if (!notesSnap.exists()) {
      return {
        success: false,
        error: 'Notes document not found',
      };
    }

    const data = notesSnap.data() as SharedNotesData;
    const notes = data.notes || [];

    // Find and update the note
    const noteIndex = notes.findIndex((note) => note.id === noteId);
    if (noteIndex === -1) {
      return {
        success: false,
        error: 'Note not found',
      };
    }

    // Validate title if provided
    if (updates.title !== undefined) {
      const trimmedTitle = updates.title.trim();
      if (!trimmedTitle) {
        return {
          success: false,
          error: 'Note title cannot be empty',
        };
      }
      if (trimmedTitle.length > 50) {
        return {
          success: false,
          error: 'Note title must be 50 characters or less',
        };
      }
      notes[noteIndex].title = trimmedTitle;
    }

    if (updates.content !== undefined) {
      notes[noteIndex].content = updates.content;
    }

    // Use Timestamp.now() instead of serverTimestamp() for fields inside arrays
    notes[noteIndex].updatedAt = Timestamp.now();
    notes[noteIndex].updatedBy = updatedBy;

    // Update document
    await updateDoc(notesRef, {
      notes,
      updatedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error updating shared note:', error);
    return {
      success: false,
      error: error.message || 'Failed to update note',
    };
  }
};

/**
 * Delete a shared note
 */
export const deleteSharedNote = async (
  uid1: string,
  uid2: string,
  noteId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    await ensureFirestoreReady();

    const notesId = getSharedNotesId(uid1, uid2);
    const notesRef = doc(db, 'sharedNotes', notesId);

    // Get current notes
    const notesSnap = await getDoc(notesRef);
    if (!notesSnap.exists()) {
      return {
        success: false,
        error: 'Notes document not found',
      };
    }

    const data = notesSnap.data() as SharedNotesData;
    const notes = data.notes || [];

    // Find and remove the note
    const noteIndex = notes.findIndex((note) => note.id === noteId);
    if (noteIndex === -1) {
      return {
        success: false,
        error: 'Note not found',
      };
    }

    // Remove note from array
    const updatedNotes = notes.filter((note) => note.id !== noteId);

    // Update document
    await updateDoc(notesRef, {
      notes: updatedNotes,
      updatedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting shared note:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete note',
    };
  }
};
