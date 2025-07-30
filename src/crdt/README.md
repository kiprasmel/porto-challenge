# CRDT (Conflict-free Replicated Data Type) Implementation

## Overview

This CRDT implementation provides a robust foundation for collaborative editing in the note-taking application. It uses **Operational Transformation** to handle concurrent edits from multiple users without conflicts.

## Architecture

### Core Components

1. **Types** (`types.ts`)
   - `CRDTOperation`: Individual edit operations (insert, delete, retain)
   - `CRDTDocument`: Contains operations and current text state
   - `CRDTNote`: Note with title and body documents
   - `CRDTState`: Client state management

2. **Utils** (`utils.ts`)
   - Text diff calculation
   - Operation transformation
   - Document reconstruction
   - Conflict resolution

3. **Hook** (`useCRDT.ts`)
   - React integration
   - State management
   - Real-time sync handling

## Key Features

### ✅ Conflict-free Collaboration
- Multiple users can edit simultaneously
- Automatic conflict resolution
- Deterministic operation ordering
- No data loss during conflicts

### ✅ Operational Transformation
- Transform concurrent operations
- Maintain document consistency
- Handle insert/delete conflicts
- Position-aware transformations

### ✅ Real-time Sync
- Background operation synchronization
- Pending operations tracking
- Acknowledgment system
- Offline support

### ✅ Text Diff Engine
- Efficient difference calculation
- Minimal operation generation
- Character-level precision
- Performance optimized

## Usage

### Basic Integration

```typescript
import { useCRDT } from './crdt/useCRDT';

function NoteEditor() {
  const {
    notes,
    createNote,
    updateNoteTitle,
    updateNoteBody,
    applyRemoteOperations,
    getPendingOperations
  } = useCRDT({
    currentWorkspace: 'workspace-1',
    initialNotes: [],
    author: 'user@example.com'
  });

  // Create a new note
  const newNote = createNote();

  // Update note content
  updateNoteTitle(noteId, 'New Title');
  updateNoteBody(noteId, 'New content...');

  // Sync with server
  const pendingOps = getPendingOperations();
  // Send pendingOps to server
  
  // Apply operations from server
  applyRemoteOperations(serverOperations);
}
```

### Server Integration

```typescript
// Send operations to server
const syncWithServer = async () => {
  const operations = getPendingOperations();
  
  const response = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operations })
  });
  
  const result = await response.json();
  
  // Acknowledge sent operations
  acknowledgeOperations(operations.map(op => op.id));
  
  // Apply operations from other users
  if (result.operations) {
    applyRemoteOperations(result.operations);
  }
};
```

## Operation Types

### Insert Operation
```typescript
{
  id: 'unique-id',
  type: 'insert',
  position: 10,
  content: 'Hello world',
  timestamp: Date.now(),
  author: 'user@example.com',
  noteId: 'note-123',
  fieldType: 'body',
  clientId: 'client-abc',
  sequenceNumber: 1
}
```

### Delete Operation
```typescript
{
  id: 'unique-id',
  type: 'delete',
  position: 5,
  length: 7,
  timestamp: Date.now(),
  author: 'user@example.com',
  noteId: 'note-123',
  fieldType: 'title',
  clientId: 'client-abc',
  sequenceNumber: 2
}
```

## Conflict Resolution

### Concurrent Insertions
When two users insert text at the same position:
- Operations are ordered by timestamp
- Tie-breaking uses client ID
- Both insertions are preserved
- Deterministic final order

### Overlapping Deletions
When deletions overlap:
- Calculate intersection
- Adjust deletion ranges
- Avoid double-deletion
- Preserve user intent

### Insert vs Delete Conflicts
When insert and delete operations conflict:
- Position-based resolution
- Insertion takes precedence within deletion range
- Maintains document integrity

## Performance Considerations

### Efficient Diff Algorithm
- O(n) time complexity for most cases
- Minimal operation generation
- Character-level precision
- Optimized for typing patterns

### Operation Storage
- Compressed operation format
- Periodic garbage collection
- Version-based snapshots
- Efficient serialization

### Memory Management
- Bounded operation history
- Automatic cleanup of acknowledged operations
- Client-side storage optimization
- Lazy loading of old operations

## Testing

Run the comprehensive test suite:

```typescript
import { runCRDTTests, testCollaborativeEditing } from './crdt/test';

// Run all tests
runCRDTTests();

// Test collaborative scenarios
testCollaborativeEditing();
```

Or in the browser console:
```javascript
runCRDTTests();
testCollaborativeEditing();
```

## Error Handling

### Operation Validation
- Position bounds checking
- Content validation
- Type safety enforcement
- Graceful degradation

### Network Failures
- Automatic retry mechanism
- Offline operation queuing
- Conflict resolution on reconnection
- Data integrity preservation

### Edge Cases
- Empty document handling
- Large operation batches
- Rapid sequential edits
- Client disconnection scenarios

## Future Enhancements

### Planned Features
1. **Rich Text Support**
   - Formatting operations
   - Nested document structures
   - Collaborative cursors

2. **Performance Optimizations**
   - Delta compression
   - Operation squashing
   - Batch processing

3. **Advanced Conflict Resolution**
   - Semantic conflict detection
   - User preference handling
   - Manual conflict resolution UI

4. **Real-time Features**
   - Live cursors
   - Presence indicators
   - Typing indicators

## Security Considerations

### Operation Validation
- Author verification
- Permission checking
- Rate limiting
- Input sanitization

### Data Integrity
- Operation signatures
- Tamper detection
- Audit logging
- Backup strategies

## Monitoring & Debugging

### Debug Mode
Set `localStorage.debug = 'crdt'` to enable detailed logging:
- Operation generation
- Transformation steps
- Conflict resolution
- Performance metrics

### Metrics
- Operation count per document
- Conflict resolution frequency
- Sync latency
- Memory usage

## Migration Guide

### From Raw Text to CRDT
1. Update data structures
2. Implement operation generation
3. Add sync mechanism
4. Test thoroughly
5. Deploy gradually

### Backward Compatibility
- Support legacy data format
- Gradual migration strategy
- Fallback mechanisms
- Version detection

## API Reference

### Core Functions

#### `calculateTextDiff(oldText, newText)`
Calculates the difference between two text strings.

#### `textChangesToOperations(changes, noteId, fieldType, clientId, sequenceNumber, author)`
Converts text changes to CRDT operations.

#### `transformOperation(ownOp, otherOp)`
Transforms two concurrent operations for conflict resolution.

#### `applyOperations(operations, fieldType)`
Reconstructs text from a list of operations.

#### `mergeOperations(localOps, remoteOps)`
Merges operations from different sources.

### Hook Functions

#### `createNote()`
Creates a new CRDT note.

#### `updateNoteTitle(noteId, newTitle)`
Updates note title with CRDT operations.

#### `updateNoteBody(noteId, newBody)`
Updates note body with CRDT operations.

#### `applyRemoteOperations(operations)`
Applies operations from other clients.

#### `getPendingOperations()`
Gets operations waiting for server acknowledgment.

#### `acknowledgeOperations(operationIds)`
Marks operations as acknowledged by server.

---

This CRDT implementation provides a solid foundation for collaborative editing that can be extended and customized for various use cases. The design prioritizes correctness, performance, and user experience while maintaining the flexibility to evolve with future requirements. 
