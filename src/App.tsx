import { useEffect, useRef, useState, useCallback } from 'react'
import './App.css'

interface User {
  username: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface Note {
  id: number;
  title: string;
  body: string;
  created_at?: string;
  updated_at?: string;
  localId?: string;
  isDirty?: boolean;
  isLocalOnly?: boolean;
}

interface Workspace {
  id: string;
  name: string;
  created_at: string;
}

interface PendingSave {
  noteId: string;
  title: string;
  body: string;
  timestamp: number;
}

function NoteApp() {
  const [currentWorkspace, setCurrentWorkspace] = useState<string>('default');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [noteBody, setNoteBody] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionResults, setMentionResults] = useState<User[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showWorkspaces, setShowWorkspaces] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingSaves, setPendingSaves] = useState<PendingSave[]>([]);
  
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const mentionStartPos = useRef<number>(0);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const saveQueueRef = useRef<PendingSave[]>([]);

  // API URLs
  const getNotesAPI = () => `https://challenge.surfe.com/${currentWorkspace}/notes`;
  const USERS_API = `https://challenge.surfe.com/users`;

  // Local storage keys
  const getLocalStorageKey = (key: string) => `notes_${currentWorkspace}_${key}`;

  // Load workspaces from localStorage
  useEffect(() => {
    const savedWorkspaces = localStorage.getItem('workspaces');
    if (savedWorkspaces) {
      setWorkspaces(JSON.parse(savedWorkspaces));
    } else {
      const defaultWorkspace = { id: 'default', name: 'Default Workspace', created_at: new Date().toISOString() };
      setWorkspaces([defaultWorkspace]);
      localStorage.setItem('workspaces', JSON.stringify([defaultWorkspace]));
    }
  }, []);

  // Create initial new note
  const createInitialNote = useCallback(() => {
    const newNote: Note = {
      id: Date.now(),
      localId: `local_${Date.now()}`,
      title: '',
      body: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      isDirty: false,
      isLocalOnly: true
    };
    
    setCurrentNote(newNote);
    setNoteBody('');
    setNoteTitle('');
    setHasUnsavedChanges(false);
    
    // Focus title after a short delay to ensure DOM is ready
    setTimeout(() => titleInputRef.current?.focus(), 150);
    
    return newNote;
  }, []);

  // Load notes from localStorage and server when workspace changes
  useEffect(() => {
    if (!currentWorkspace) return;
    
    setLoading(true);
    
    // Load from localStorage first for instant UI
    const localNotes = localStorage.getItem(getLocalStorageKey('notes'));
    let parsedNotes: Note[] = [];
    if (localNotes) {
      try {
        parsedNotes = JSON.parse(localNotes);
        setNotes(parsedNotes);
      } catch (e) {
        console.error('Error parsing local notes:', e);
      }
    }
    
    // Create initial note if no notes exist
    if (parsedNotes.length === 0) {
      const initialNote = createInitialNote();
      parsedNotes = [initialNote];
      setNotes(parsedNotes);
    } else {
      // Focus title for new workspace
      setTimeout(() => titleInputRef.current?.focus(), 150);
    }
    
    // Then sync with server
    Promise.all([
      fetch(getNotesAPI()).then(res => res.ok ? res.json() : []).catch(() => []),
      fetch(USERS_API).then(res => res.ok ? res.json() : []).catch(() => [])
    ])
    .then(([serverNotes, users]) => {
      setUsers(Array.isArray(users) ? users : []);
      
      if (Array.isArray(serverNotes) && serverNotes.length > 0) {
        // Merge server notes with local notes
        const mergedNotes = mergeNotesWithLocal(serverNotes, parsedNotes);
        setNotes(mergedNotes);
        saveNotesToLocal(mergedNotes);
      }
      
      setLoading(false);
      setError(null);
    })
    .catch(() => {
      setError('Failed to sync with server. Working offline.');
      setLoading(false);
    });
  }, [currentWorkspace, createInitialNote]);

  // Background save queue processor
  useEffect(() => {
    const processSaveQueue = async () => {
      if (saveQueueRef.current.length === 0 || saving) return;
      
      const pendingSave = saveQueueRef.current[0];
      setSaving(true);
      
      try {
        const note = notes.find(n => 
          n.localId === pendingSave.noteId || n.id.toString() === pendingSave.noteId
        );
        
        if (!note) {
          saveQueueRef.current.shift();
          setSaving(false);
          return;
        }
        
        const method = note.isLocalOnly ? 'POST' : 'PUT';
        const url = note.isLocalOnly ? getNotesAPI() : `${getNotesAPI()}/${note.id}`;
        
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            title: pendingSave.title || 'Untitled Note', 
            body: pendingSave.body 
          }),
        });

        if (!response.ok) throw new Error('Server save failed');
        
        const savedNote = await response.json();
        
        // Update note with server response
        const finalNote: Note = {
          ...savedNote,
          title: savedNote.title || pendingSave.title || 'Untitled Note',
          isDirty: false,
          isLocalOnly: false
        };
        
        setNotes(prev => {
          const updated = prev.map(n => 
            (n.id === note.id || n.localId === note.localId) ? finalNote : n
          );
          saveNotesToLocal(updated);
          return updated;
        });
        
        if (currentNote && (currentNote.id === note.id || currentNote.localId === note.localId)) {
          setCurrentNote(finalNote);
        }
        
        // Remove from queue
        saveQueueRef.current.shift();
        setPendingSaves(prev => prev.slice(1));
        setLastSaved(new Date());
        
      } catch (err) {
        console.error('Background save failed:', err);
        // Keep in queue for retry
      }
      
      setSaving(false);
    };
    
    const interval = setInterval(processSaveQueue, 2000);
    return () => clearInterval(interval);
  }, [notes, saving, currentNote, getNotesAPI]);

  // Merge server notes with local notes, preserving local changes
  const mergeNotesWithLocal = (serverNotes: any[], localNotes: Note[]): Note[] => {
    const merged = [...serverNotes.map(note => ({
      ...note,
      title: note.title || `Note ${note.id}`,
      isDirty: false,
      isLocalOnly: false
    }))];
    
    // Add local-only notes
    localNotes.forEach(localNote => {
      if (localNote.isLocalOnly || !merged.find(n => n.id === localNote.id)) {
        merged.unshift(localNote);
      } else {
        // Check if local version is newer/different
        const serverNote = merged.find(n => n.id === localNote.id);
        if (serverNote && localNote.isDirty) {
          Object.assign(serverNote, localNote);
        }
      }
    });
    
    return merged.sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime());
  };

  // Save notes to localStorage
  const saveNotesToLocal = (notesToSave: Note[]) => {
    localStorage.setItem(getLocalStorageKey('notes'), JSON.stringify(notesToSave));
  };

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, []);

  // Create new workspace
  const createWorkspace = (name: string) => {
    const newWorkspace: Workspace = {
      id: `workspace-${Date.now()}`,
      name,
      created_at: new Date().toISOString()
    };
    const updatedWorkspaces = [...workspaces, newWorkspace];
    setWorkspaces(updatedWorkspaces);
    localStorage.setItem('workspaces', JSON.stringify(updatedWorkspaces));
    setCurrentWorkspace(newWorkspace.id);
    setShowWorkspaces(false);
  };

  // Create new note (always allow, save current in background)
  const createNewNote = () => {
    // Add current note to save queue if it has changes
    if (currentNote && hasUnsavedChanges) {
      const pendingSave: PendingSave = {
        noteId: currentNote.localId || currentNote.id.toString(),
        title: noteTitle,
        body: noteBody,
        timestamp: Date.now()
      };
      
      saveQueueRef.current.push(pendingSave);
      setPendingSaves(prev => [...prev, pendingSave]);
      
      // Update current note in local state
      const updatedNote: Note = {
        ...currentNote,
        title: noteTitle.trim() || 'Untitled Note',
        body: noteBody,
        updated_at: new Date().toISOString(),
        isDirty: true
      };
      
      setNotes(prev => {
        const updated = prev.map(n => 
          (n.id === currentNote.id || n.localId === currentNote.localId) ? updatedNote : n
        );
        
        // Add to list if it's not already there
        if (!updated.some(n => n.id === currentNote.id || n.localId === currentNote.localId)) {
          updated.unshift(updatedNote);
        }
        
        saveNotesToLocal(updated);
        return updated;
      });
    }
    
    // Create new note
    const newNote: Note = {
      id: Date.now(),
      localId: `local_${Date.now()}`,
      title: '',
      body: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      isDirty: false,
      isLocalOnly: true
    };
    
    setCurrentNote(newNote);
    setNoteBody('');
    setNoteTitle('');
    setHasUnsavedChanges(false);
    
    setTimeout(() => titleInputRef.current?.focus(), 100);
  };

  // Select note with background saving
  const selectNote = (note: Note) => {
    // Add current note to save queue if it has changes
    if (currentNote && hasUnsavedChanges) {
      const pendingSave: PendingSave = {
        noteId: currentNote.localId || currentNote.id.toString(),
        title: noteTitle,
        body: noteBody,
        timestamp: Date.now()
      };
      
      saveQueueRef.current.push(pendingSave);
      setPendingSaves(prev => [...prev, pendingSave]);
      
      // Update current note in local state
      const updatedNote: Note = {
        ...currentNote,
        title: noteTitle.trim() || 'Untitled Note',
        body: noteBody,
        updated_at: new Date().toISOString(),
        isDirty: true
      };
      
      setNotes(prev => {
        const updated = prev.map(n => 
          (n.id === currentNote.id || n.localId === currentNote.localId) ? updatedNote : n
        );
        saveNotesToLocal(updated);
        return updated;
      });
    }
    
    setCurrentNote(note);
    setNoteBody(note.body);
    setNoteTitle(note.title);
    setHasUnsavedChanges(false);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  // Handle title change
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNoteTitle(value);
    setHasUnsavedChanges(true);
  };

  // Handle title key press (Enter to jump to body)
  const handleTitleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      textareaRef.current?.focus();
    }
  };

  // Handle title focus - clear if it's placeholder
  const handleTitleFocus = () => {
    if (noteTitle === 'Untitled Note' || noteTitle === '') {
      setNoteTitle('');
    }
  };

  // Enhanced mention detection with better positioning
  const detectMention = useCallback((value: string, selectionStart: number) => {
    const textBeforeCursor = value.slice(0, selectionStart);
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_]*)$/);
    
    if (match) {
      const mentionStart = selectionStart - match[0].length;
      mentionStartPos.current = mentionStart;
      setMentionQuery(match[1]);
      setShowMentions(true);
      
      // Enhanced search with all users initially
      const query = match[1].toLowerCase();
      let filtered = users;
      
      if (query === '') {
        // Show ALL users initially with scrolling, minimum 5
        filtered = users.slice(0, Math.max(5, Math.min(20, users.length)));
      } else {
        // Multi-field fuzzy search
        filtered = users.filter(user => {
          const username = user.username?.toLowerCase() || '';
          const firstName = user.first_name?.toLowerCase() || '';
          const lastName = user.last_name?.toLowerCase() || '';
          const email = user.email?.toLowerCase() || '';
          const fullName = `${firstName} ${lastName}`.trim();
          
          return (
            username.includes(query) ||
            firstName.includes(query) ||
            lastName.includes(query) ||
            fullName.includes(query) ||
            email.includes(query) ||
            // Fuzzy matching - check if query characters appear in order
            fuzzyMatch(username, query) ||
            fuzzyMatch(fullName, query)
          );
        });
        
        // Sort by relevance
        filtered.sort((a, b) => {
          const aUsername = a.username?.toLowerCase() || '';
          const bUsername = b.username?.toLowerCase() || '';
          const aFullName = `${a.first_name} ${a.last_name}`.toLowerCase();
          const bFullName = `${b.first_name} ${b.last_name}`.toLowerCase();
          
          // Exact username match first
          if (aUsername.startsWith(query) && !bUsername.startsWith(query)) return -1;
          if (bUsername.startsWith(query) && !aUsername.startsWith(query)) return 1;
          
          // Then full name match
          if (aFullName.startsWith(query) && !bFullName.startsWith(query)) return -1;
          if (bFullName.startsWith(query) && !aFullName.startsWith(query)) return 1;
          
          // Then username contains
          if (aUsername.includes(query) && !bUsername.includes(query)) return -1;
          if (bUsername.includes(query) && !aUsername.includes(query)) return 1;
          
          return 0;
        });
      }
      
      setMentionResults(filtered);
      setMentionIndex(0);
      
      // Calculate position to the right of cursor
      if (textareaRef.current) {
        const textarea = textareaRef.current;
        const rect = textarea.getBoundingClientRect();
        const style = window.getComputedStyle(textarea);
        const fontSize = parseFloat(style.fontSize);
        const lineHeight = parseFloat(style.lineHeight) || fontSize * 1.5;
        
        // Calculate cursor position
        const textUpToMention = value.slice(0, mentionStart);
        const lines = textUpToMention.split('\n');
        const currentLine = lines.length - 1;
        const currentColumn = lines[lines.length - 1].length;
        
        // Position to the right of cursor
        const x = rect.left + 12 + (currentColumn * fontSize * 0.6) + 20; // Add offset to right
        const y = rect.top + 12 + (currentLine * lineHeight);
        
        // Ensure dropdown fits in viewport
        const dropdownWidth = 320;
        const dropdownHeight = Math.min(420, filtered.length * 60 + 80); // Estimate height with larger max
        
        const finalX = Math.min(x, window.innerWidth - dropdownWidth - 20);
        const finalY = Math.min(y, window.innerHeight - dropdownHeight - 20);
        
        // Position the dropdown
        setTimeout(() => {
          const dropdown = document.querySelector('.mentions-dropdown') as HTMLElement;
          if (dropdown) {
            dropdown.style.left = `${finalX}px`;
            dropdown.style.top = `${finalY}px`;
          }
        }, 0);
      }
    } else {
      setShowMentions(false);
      setMentionQuery('');
      setMentionIndex(0);
    }
  }, [users]);

  // Fuzzy matching helper
  const fuzzyMatch = (text: string, query: string): boolean => {
    let textIndex = 0;
    let queryIndex = 0;
    
    while (textIndex < text.length && queryIndex < query.length) {
      if (text[textIndex] === query[queryIndex]) {
        queryIndex++;
      }
      textIndex++;
    }
    
    return queryIndex === query.length;
  };

  // Handle text change
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const selectionStart = e.target.selectionStart;
    
    setNoteBody(value);
    setHasUnsavedChanges(true);
    autoResize();
    
    // Mention detection
    detectMention(value, selectionStart);
  };

  // Fixed keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle Cmd+Enter to submit and create new note
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      
      // Add current note to save queue if it has changes
      if (currentNote && (hasUnsavedChanges || noteTitle.trim() || noteBody.trim())) {
        const pendingSave: PendingSave = {
          noteId: currentNote.localId || currentNote.id.toString(),
          title: noteTitle.trim() || 'Untitled Note',
          body: noteBody,
          timestamp: Date.now()
        };
        
        saveQueueRef.current.push(pendingSave);
        setPendingSaves(prev => [...prev, pendingSave]);
        
        // Update current note in local state
        const updatedNote: Note = {
          ...currentNote,
          title: noteTitle.trim() || 'Untitled Note',
          body: noteBody,
          updated_at: new Date().toISOString(),
          isDirty: true
        };
        
        setNotes(prev => {
          const updated = prev.map(n => 
            (n.id === currentNote.id || n.localId === currentNote.localId) ? updatedNote : n
          );
          
          // Add to list if it's not already there
          if (!updated.some(n => n.id === currentNote.id || n.localId === currentNote.localId)) {
            updated.unshift(updatedNote);
          }
          
          saveNotesToLocal(updated);
          return updated;
        });
      }
      
      // Create new note
      const newNote: Note = {
        id: Date.now(),
        localId: `local_${Date.now()}`,
        title: '',
        body: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        isDirty: false,
        isLocalOnly: true
      };
      
      setCurrentNote(newNote);
      setNoteBody('');
      setNoteTitle('');
      setHasUnsavedChanges(false);
      
      // Focus title for new note
      setTimeout(() => titleInputRef.current?.focus(), 100);
      return;
    }
    
    if (!showMentions || mentionResults.length === 0) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % mentionResults.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + mentionResults.length) % mentionResults.length);
        break;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        insertMention(mentionResults[mentionIndex]);
        break;
      case 'Escape':
        setShowMentions(false);
        break;
    }
  };

  // Fixed mention insertion
  const insertMention = (user: User) => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const currentPos = textarea.selectionStart;
    const before = noteBody.slice(0, mentionStartPos.current);
    const after = noteBody.slice(currentPos);
    const mentionText = `@${user.username}`;
    const newBody = before + mentionText + ' ' + after;
    
    setNoteBody(newBody);
    setHasUnsavedChanges(true);
    setShowMentions(false);
    setMentionQuery('');
    setMentionIndex(0);
    
    // Set cursor after mention
    setTimeout(() => {
      const newPos = before.length + mentionText.length + 1;
      textarea.focus();
      textarea.setSelectionRange(newPos, newPos);
      autoResize();
    }, 0);
  };

  // Format time
  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  // Get note preview
  const getNotePreview = (body: string) => {
    return body.slice(0, 80).replace(/\n/g, ' ') || 'Empty note';
  };

  // Get note display title
  const getNoteDisplayTitle = (note: Note) => {
    if (note.title && note.title !== 'Untitled Note') {
      return note.title;
    }
    const preview = getNotePreview(note.body);
    return preview.length > 30 ? preview.slice(0, 30) + '...' : preview || 'Untitled Note';
  };

  // Click outside to close mentions
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const textarea = textareaRef.current;
      const dropdown = document.querySelector('.mentions-dropdown');
      if (
        showMentions &&
        textarea && !textarea.contains(e.target as Node) &&
        dropdown && !dropdown.contains(e.target as Node)
      ) {
        setShowMentions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMentions]);

  if (loading) {
    return (
      <div className="note-app">
        <div className="loading-skeleton">
          <div className="skeleton-sidebar"></div>
          <div className="skeleton-editor"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="note-app">
      <div className="app-layout">
        {/* Editor - Left Side */}
        <div className="editor">
          {/* Workspace Section */}
          <div className="workspace-section">
            <div className="workspace-header">
              <h2>🏢 Workspaces</h2>
              <button 
                className="workspace-toggle"
                onClick={() => setShowWorkspaces(!showWorkspaces)}
              >
                {showWorkspaces ? '▼' : '▶'}
              </button>
            </div>
            
            <div className="current-workspace">
              <span className="workspace-name">
                {workspaces.find(w => w.id === currentWorkspace)?.name || 'Default'}
              </span>
            </div>

            {showWorkspaces && (
              <div className="workspace-list">
                {workspaces.map(workspace => (
                  <div
                    key={workspace.id}
                    className={`workspace-item ${workspace.id === currentWorkspace ? 'active' : ''}`}
                    onClick={() => {
                      setCurrentWorkspace(workspace.id);
                      setShowWorkspaces(false);
                    }}
                  >
                    <span>{workspace.name}</span>
                  </div>
                ))}
                <button
                  className="create-workspace-btn"
                  onClick={() => {
                    const name = prompt('Workspace name:');
                    if (name) createWorkspace(name);
                  }}
                >
                  ➕ New Workspace
                </button>
              </div>
            )}
          </div>

          <div className="editor-header">
            <h1>✍️ {currentNote ? (currentNote.isLocalOnly ? 'New Note' : `Note #${currentNote.id}`) : 'New Note'}</h1>
            <div className="header-actions">
              <button className="new-note-btn" onClick={createNewNote}>
                ➕ New
              </button>
              {pendingSaves.length > 0 && (
                <span className="pending-saves">
                  💾 {pendingSaves.length} saving...
                </span>
              )}
            </div>
          </div>
          
          <input
            ref={titleInputRef}
            className="note-title-input"
            value={noteTitle}
            onChange={handleTitleChange}
            onKeyPress={handleTitleKeyPress}
            onFocus={handleTitleFocus}
            placeholder="✨ Note title..."
          />
          
          <div className="textarea-container">
            <textarea
              ref={textareaRef}
              value={noteBody}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Start typing your note... Use @ to mention users 🚀"
              className="note-textarea"
              rows={20}
            />
            
            {showMentions && mentionResults.length > 0 && (
              <div className="mentions-dropdown">
                <div className="mentions-header">
                  🔍 Mention someone ({mentionResults.length} {mentionQuery === '' ? 'users' : 'found'})
                </div>
                <div className="mentions-list">
                  {mentionResults.map((user, idx) => (
                    <div
                      key={user.username}
                      className={`mention-item ${idx === mentionIndex ? 'selected' : ''}`}
                      onClick={() => insertMention(user)}
                    >
                      <div className="mention-avatar">
                        {user.first_name?.[0]?.toUpperCase() || user.username[0]?.toUpperCase()}
                      </div>
                      <div className="mention-info">
                        <div className="mention-username">@{user.username}</div>
                        <div className="mention-name">
                          {user.first_name} {user.last_name}
                        </div>
                        {user.email && (
                          <div className="mention-email">
                            {user.email}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mentions-footer">
                  ↑↓ Navigate • Enter/Tab Select • Esc Close
                </div>
              </div>
            )}
          </div>
          
          <div className="status-bar">
            <div className="status-left">
              {error ? (
                <span className="error">⚠️ {error}</span>
              ) : saving ? (
                <span className="saving">💾 Saving...</span>
              ) : hasUnsavedChanges ? (
                <span className="unsaved">✏️ Unsaved changes</span>
              ) : (
                <span className="saved">✅ Saved {lastSaved ? formatTime(lastSaved.toISOString()) : ''}</span>
              )}
              <span className="shortcut-hint">⌘+Enter to submit & new note</span>
            </div>
            <div className="status-right">
              {noteBody.length} chars • {noteBody.split('\n').length} lines
            </div>
          </div>
        </div>

        {/* Notes List - Right Side */}
        <div className="notes-sidebar">
          <div className="notes-header">
            <h2>📝 Notes ({notes.length})</h2>
          </div>
          
          <div className="sticky-notes-grid">
            {notes.length === 0 ? (
              <div className="empty-state">
                <p>Start typing to create your first note!</p>
              </div>
            ) : (
              notes.map(note => (
                <div
                  key={note.localId || note.id}
                  className={`sticky-note ${currentNote?.id === note.id || currentNote?.localId === note.localId ? 'active' : ''} ${note.isDirty ? 'dirty' : ''}`}
                  onClick={() => selectNote(note)}
                >
                  <div className="sticky-note-header">
                    <span className="note-id">
                      {note.isLocalOnly ? '✨' : `#${note.id}`}
                      {note.isDirty && <span className="dirty-indicator">●</span>}
                    </span>
                    <span className="note-date">{formatTime(note.updated_at || note.created_at)}</span>
                  </div>
                  <div className="sticky-note-title">
                    {getNoteDisplayTitle(note)}
                  </div>
                  <div className="sticky-note-content">
                    {getNotePreview(note.body)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default NoteApp
