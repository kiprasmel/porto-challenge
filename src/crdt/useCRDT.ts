import { useState, useEffect, useRef, useCallback } from 'react';
import type { CRDTNote, CRDTOperation, CRDTDocument, CRDTState } from './types';
import { 
  calculateTextDiff, 
  textChangesToOperations, 
  applyOperations, 
  mergeOperations, 
  createCRDTDocument
} from './utils';

interface UseCRDTProps {
  currentWorkspace: string;
  initialNotes?: CRDTNote[];
  author: string;
}

interface UseCRDTReturn {
  notes: CRDTNote[];
  crdtState: CRDTState;
  createNote: () => CRDTNote;
  updateNoteTitle: (noteId: string, newTitle: string) => void;
  updateNoteBody: (noteId: string, newBody: string) => void;
  applyRemoteOperations: (operations: CRDTOperation[]) => void;
  getPendingOperations: () => CRDTOperation[];
  acknowledgeOperations: (operationIds: string[]) => void;
  mergeNoteFromServer: (serverNote: any) => void;
  reconstructNote: (noteId: string) => { title: string; body: string } | null;
  saveNotesToLocal: (notes: CRDTNote[]) => void;
  loadNotesFromLocal: () => CRDTNote[];
  getDocumentStats: (noteId: string) => { title: any; body: any } | null;
}

export function useCRDT({ currentWorkspace, initialNotes: _initialNotes = [], author }: UseCRDTProps): UseCRDTReturn {
  const [notes, setNotes] = useState<CRDTNote[]>([]);
  const [crdtState, setCRDTState] = useState<CRDTState>(() => ({
    clientId: `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    sequenceCounter: 0,
    pendingOperations: new Map(),
    acknowledgedOperations: new Set()
  }));

  const lastTitleRef = useRef<Map<string, string>>(new Map());
  const lastBodyRef = useRef<Map<string, string>>(new Map());

  // Load notes when workspace changes
  useEffect(() => {
    if (!currentWorkspace) return;
    
    console.log('🔄 CRDT: Loading notes for workspace:', currentWorkspace);
    
    try {
      const key = `crdt_${currentWorkspace}_notes`;
      const saved = localStorage.getItem(key);
      const loadedNotes = saved ? JSON.parse(saved) : [];
      
      console.log('📚 CRDT: Loaded notes:', loadedNotes.length);
      setNotes(loadedNotes);
    } catch (error) {
      console.error('❌ CRDT: Failed to load notes from localStorage:', error);
      setNotes([]);
    }
    
    // Clear refs for new workspace
    lastTitleRef.current.clear();
    lastBodyRef.current.clear();
  }, [currentWorkspace]);

  // Local storage functions
  const getLocalStorageKey = useCallback((key: string) => `crdt_${currentWorkspace}_${key}`, [currentWorkspace]);

  const saveNotesToLocal = useCallback((notesToSave: CRDTNote[]) => {
    try {
      localStorage.setItem(getLocalStorageKey('notes'), JSON.stringify(notesToSave));
    } catch (error) {
      console.error('Failed to save notes to localStorage:', error);
    }
  }, [getLocalStorageKey]);

  const loadNotesFromLocal = useCallback((): CRDTNote[] => {
    try {
      const saved = localStorage.getItem(getLocalStorageKey('notes'));
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Failed to load notes from localStorage:', error);
      return [];
    }
  }, [getLocalStorageKey]);

  // Create a new note
  const createNote = useCallback((): CRDTNote => {
    console.log('✨ CRDT: Creating new note...');
    
    const newNote: CRDTNote = {
      id: Date.now(),
      localId: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      titleDocument: createCRDTDocument(''),
      bodyDocument: createCRDTDocument(''),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      isDirty: false,
      isLocalOnly: true,
      lastSyncedVersion: 0,
      conflictResolutionNeeded: false
    };

    console.log('📝 CRDT: New note created:', newNote.localId);

    setNotes(prev => {
      const updated = [newNote, ...prev];
      console.log('💾 CRDT: Saving notes to localStorage, count:', updated.length);
      saveNotesToLocal(updated);
      return updated;
    });

    return newNote;
  }, [saveNotesToLocal]);

  // Update note title
  const updateNoteTitle = useCallback((noteId: string, newTitle: string) => {
    setNotes(prev => {
      const updated = prev.map(note => {
        const id = note.localId || note.id.toString();
        if (id !== noteId) return note;

        const lastTitle = lastTitleRef.current.get(noteId) || '';
        const changes = calculateTextDiff(lastTitle, newTitle);
        
        if (changes.length === 0) return note;

        // Generate operations
        const operations = textChangesToOperations(
          changes,
          noteId,
          'title',
          crdtState.clientId,
          crdtState.sequenceCounter,
          author
        );

        // Update sequence counter
        setCRDTState(prev => ({
          ...prev,
          sequenceCounter: prev.sequenceCounter + operations.length
        }));

        // Update document
        const newDocument: CRDTDocument = {
          ...note.titleDocument,
          operations: [...note.titleDocument.operations, ...operations],
          currentText: newTitle,
          version: note.titleDocument.version + 1,
          lastModified: Date.now()
        };

        // Store current text for next comparison
        lastTitleRef.current.set(noteId, newTitle);

        // Add to pending operations
        const pendingOps = crdtState.pendingOperations.get(noteId) || [];
        setCRDTState(prev => ({
          ...prev,
          pendingOperations: new Map(prev.pendingOperations).set(noteId, [...pendingOps, ...operations])
        }));

        return {
          ...note,
          titleDocument: newDocument,
          updated_at: new Date().toISOString(),
          isDirty: true
        };
      });

      saveNotesToLocal(updated);
      return updated;
    });
  }, [crdtState.clientId, crdtState.sequenceCounter, author, saveNotesToLocal]);

  // Update note body
  const updateNoteBody = useCallback((noteId: string, newBody: string) => {
    setNotes(prev => {
      const updated = prev.map(note => {
        const id = note.localId || note.id.toString();
        if (id !== noteId) return note;

        const lastBody = lastBodyRef.current.get(noteId) || '';
        const changes = calculateTextDiff(lastBody, newBody);
        
        if (changes.length === 0) return note;

        // Generate operations
        const operations = textChangesToOperations(
          changes,
          noteId,
          'body',
          crdtState.clientId,
          crdtState.sequenceCounter,
          author
        );

        // Update sequence counter
        setCRDTState(prev => ({
          ...prev,
          sequenceCounter: prev.sequenceCounter + operations.length
        }));

        // Update document
        const newDocument: CRDTDocument = {
          ...note.bodyDocument,
          operations: [...note.bodyDocument.operations, ...operations],
          currentText: newBody,
          version: note.bodyDocument.version + 1,
          lastModified: Date.now()
        };

        // Store current text for next comparison
        lastBodyRef.current.set(noteId, newBody);

        // Add to pending operations
        const pendingOps = crdtState.pendingOperations.get(noteId) || [];
        setCRDTState(prev => ({
          ...prev,
          pendingOperations: new Map(prev.pendingOperations).set(noteId, [...pendingOps, ...operations])
        }));

        return {
          ...note,
          bodyDocument: newDocument,
          updated_at: new Date().toISOString(),
          isDirty: true
        };
      });

      saveNotesToLocal(updated);
      return updated;
    });
  }, [crdtState.clientId, crdtState.sequenceCounter, author, saveNotesToLocal]);

  // Apply remote operations
  const applyRemoteOperations = useCallback((operations: CRDTOperation[]) => {
    if (operations.length === 0) return;

    setNotes(prev => {
      const updated = prev.map(note => {
        const noteId = note.localId || note.id.toString();
        const noteOps = operations.filter(op => op.noteId === noteId);
        
        if (noteOps.length === 0) return note;

        // Separate title and body operations
        const titleOps = noteOps.filter(op => op.fieldType === 'title');
        const bodyOps = noteOps.filter(op => op.fieldType === 'body');

        const updatedNote = { ...note };

        // Apply title operations
        if (titleOps.length > 0) {
          const localOps = note.titleDocument.operations;
          const mergedOps = mergeOperations(localOps, titleOps);
          const newText = applyOperations(mergedOps, 'title');
          
          updatedNote.titleDocument = {
            ...note.titleDocument,
            operations: mergedOps,
            currentText: newText,
            version: note.titleDocument.version + titleOps.length,
            lastModified: Date.now()
          };
          
          lastTitleRef.current.set(noteId, newText);
        }

        // Apply body operations
        if (bodyOps.length > 0) {
          const localOps = note.bodyDocument.operations;
          const mergedOps = mergeOperations(localOps, bodyOps);
          const newText = applyOperations(mergedOps, 'body');
          
          updatedNote.bodyDocument = {
            ...note.bodyDocument,
            operations: mergedOps,
            currentText: newText,
            version: note.bodyDocument.version + bodyOps.length,
            lastModified: Date.now()
          };
          
          lastBodyRef.current.set(noteId, newText);
        }

        return {
          ...updatedNote,
          updated_at: new Date().toISOString(),
          conflictResolutionNeeded: titleOps.length > 0 || bodyOps.length > 0
        };
      });

      saveNotesToLocal(updated);
      return updated;
    });
  }, [saveNotesToLocal]);

  // Get pending operations
  const getPendingOperations = useCallback((): CRDTOperation[] => {
    const allPending: CRDTOperation[] = [];
    
    for (const [_noteId, operations] of crdtState.pendingOperations) {
      allPending.push(...operations);
    }
    
    return allPending.filter(op => !crdtState.acknowledgedOperations.has(op.id));
  }, [crdtState.pendingOperations, crdtState.acknowledgedOperations]);

  // Acknowledge operations (remove from pending)
  const acknowledgeOperations = useCallback((operationIds: string[]) => {
    setCRDTState(prev => ({
      ...prev,
      acknowledgedOperations: new Set([...prev.acknowledgedOperations, ...operationIds])
    }));

    // Remove acknowledged operations from pending
    setCRDTState(prev => {
      const newPending = new Map(prev.pendingOperations);
      
      for (const [noteId, operations] of newPending) {
        const filtered = operations.filter(op => !operationIds.includes(op.id));
        if (filtered.length === 0) {
          newPending.delete(noteId);
        } else {
          newPending.set(noteId, filtered);
        }
      }
      
      return { ...prev, pendingOperations: newPending };
    });
  }, []);

  // Merge note from server
  const mergeNoteFromServer = useCallback((serverNote: any) => {
    // Parse server note data from body field if it's a string
    let noteData = serverNote;
    if (typeof serverNote.body === 'string') {
      try {
        noteData = JSON.parse(serverNote.body);
        noteData.id = serverNote.id; // Ensure ID is preserved
      } catch (error) {
        console.error('Failed to parse server note body:', error);
        // Fallback to treating as legacy format
        noteData = serverNote;
      }
    }
    
    const serverCRDTNote: CRDTNote = {
      id: noteData.id || serverNote.id,
      titleDocument: noteData.titleDocument || createCRDTDocument(noteData.title || ''),
      bodyDocument: noteData.bodyDocument || createCRDTDocument(noteData.content || noteData.body || ''),
      created_at: noteData.created_at || serverNote.created_at,
      updated_at: noteData.updated_at || serverNote.updated_at,
      isDirty: false,
      isLocalOnly: false,
      lastSyncedVersion: noteData.version || 0,
      conflictResolutionNeeded: false
    };

    setNotes(prev => {
      const existingIndex = prev.findIndex(n => {
        // Check if note exists by ID or localId
        return n.id === serverNote.id || 
               (n.localId && n.localId === serverNote.localId) ||
               (n.id.toString() === serverNote.id.toString());
      });
      
      if (existingIndex === -1) {
        // New note from server
        const updated = [...prev, serverCRDTNote];
        saveNotesToLocal(updated);
        return updated;
      } else {
        // Update existing note
        const updated = [...prev];
        updated[existingIndex] = serverCRDTNote;
        saveNotesToLocal(updated);
        return updated;
      }
    });
  }, [saveNotesToLocal]);

  // Reconstruct note content from operations
  const reconstructNote = useCallback((noteId: string): { title: string; body: string } | null => {
    const note = notes.find(n => (n.localId || n.id.toString()) === noteId);
    if (!note) return null;

    const title = applyOperations(note.titleDocument.operations, 'title');
    const body = applyOperations(note.bodyDocument.operations, 'body');

    return { title, body };
  }, [notes]);

  // Get document statistics
  const getDocumentStats = useCallback((noteId: string) => {
    const note = notes.find(n => (n.localId || n.id.toString()) === noteId);
    if (!note) return null;

    return {
      title: {
        totalOperations: note.titleDocument.operations.length,
        insertions: note.titleDocument.operations.filter(op => op.type === 'insert').length,
        deletions: note.titleDocument.operations.filter(op => op.type === 'delete').length,
        textLength: note.titleDocument.currentText.length
      },
      body: {
        totalOperations: note.bodyDocument.operations.length,
        insertions: note.bodyDocument.operations.filter(op => op.type === 'insert').length,
        deletions: note.bodyDocument.operations.filter(op => op.type === 'delete').length,
        textLength: note.bodyDocument.currentText.length
      }
    };
  }, [notes]);

  return {
    notes,
    crdtState,
    createNote,
    updateNoteTitle,
    updateNoteBody,
    applyRemoteOperations,
    getPendingOperations,
    acknowledgeOperations,
    mergeNoteFromServer,
    reconstructNote,
    saveNotesToLocal,
    loadNotesFromLocal,
    getDocumentStats
  };
} 
