import type { CRDTOperation, CRDTDocument, TextChange, TransformResult } from './types';

/**
 * Generate a unique operation ID
 */
export function generateOperationId(clientId: string, sequenceNumber: number): string {
  return `${clientId}-${sequenceNumber}-${Date.now()}`;
}

/**
 * Calculate text differences between old and new text
 */
export function calculateTextDiff(oldText: string, newText: string, _position: number = 0): TextChange[] {
  const changes: TextChange[] = [];
  
  // Simple diff algorithm - can be replaced with more sophisticated algorithms like Myers
  let i = 0;
  let j = 0;
  
  while (i < oldText.length && j < newText.length && oldText[i] === newText[j]) {
    i++;
    j++;
  }
  
  if (i === oldText.length && j === newText.length) {
    return changes; // No changes
  }
  
  // Find the end of the difference
  let oldEnd = oldText.length;
  let newEnd = newText.length;
  
  while (oldEnd > i && newEnd > j && oldText[oldEnd - 1] === newText[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }
  
  // Generate operations
  if (oldEnd > i) {
    // Deletion
    changes.push({
      type: 'delete',
      position: i,
      deletedContent: oldText.slice(i, oldEnd),
      length: oldEnd - i
    });
  }
  
  if (newEnd > j) {
    // Insertion
    changes.push({
      type: 'insert',
      position: i,
      content: newText.slice(j, newEnd)
    });
  }
  
  return changes;
}

/**
 * Convert text changes to CRDT operations
 */
export function textChangesToOperations(
  changes: TextChange[],
  noteId: string,
  fieldType: 'title' | 'body',
  clientId: string,
  sequenceNumber: number,
  author: string
): CRDTOperation[] {
  const operations: CRDTOperation[] = [];
  
  for (const change of changes) {
    const operation: CRDTOperation = {
      id: generateOperationId(clientId, sequenceNumber),
      type: change.type === 'replace' ? 'insert' : change.type,
      position: change.position,
      content: change.content,
      length: change.length,
      timestamp: Date.now(),
      author,
      noteId,
      fieldType,
      clientId,
      sequenceNumber
    };
    
    operations.push(operation);
    
    // For replace operations, add delete operation first
    if (change.type === 'replace' && change.deletedContent) {
      const deleteOp: CRDTOperation = {
        id: generateOperationId(clientId, sequenceNumber + 1),
        type: 'delete',
        position: change.position,
        content: change.deletedContent,
        length: change.deletedContent.length,
        timestamp: Date.now(),
        author,
        noteId,
        fieldType,
        clientId,
        sequenceNumber: sequenceNumber + 1
      };
      operations.unshift(deleteOp);
    }
  }
  
  return operations;
}

/**
 * Operational Transformation - transform operation against another operation
 */
export function transformOperation(ownOp: CRDTOperation, otherOp: CRDTOperation): TransformResult {
  const transformedOwnOp = { ...ownOp };
  const transformedOtherOp = { ...otherOp };
  let conflict = false;
  
  // If operations are on different fields, no transformation needed
  if (ownOp.fieldType !== otherOp.fieldType) {
    return { ownOp: transformedOwnOp, otherOp: transformedOtherOp, conflict };
  }
  
  // Handle concurrent operations
  if (ownOp.type === 'insert' && otherOp.type === 'insert') {
    // Both are insertions
    if (ownOp.position <= otherOp.position) {
      // Own operation comes first, adjust other's position
      transformedOtherOp.position = otherOp.position + (ownOp.content?.length || 0);
    } else {
      // Other operation comes first, adjust own position
      transformedOwnOp.position = ownOp.position + (otherOp.content?.length || 0);
    }
    
    // Handle tie-breaking for same position
    if (ownOp.position === otherOp.position) {
      conflict = true;
      // Use timestamp and client ID for deterministic ordering
      if (ownOp.timestamp < otherOp.timestamp || 
          (ownOp.timestamp === otherOp.timestamp && ownOp.clientId < otherOp.clientId)) {
        transformedOtherOp.position = otherOp.position + (ownOp.content?.length || 0);
      } else {
        transformedOwnOp.position = ownOp.position + (otherOp.content?.length || 0);
      }
    }
  } else if (ownOp.type === 'delete' && otherOp.type === 'delete') {
    // Both are deletions
    const ownEnd = ownOp.position + (ownOp.length || 0);
    const otherEnd = otherOp.position + (otherOp.length || 0);
    
    if (ownEnd <= otherOp.position) {
      // Own deletion comes before other, adjust other's position
      transformedOtherOp.position = otherOp.position - (ownOp.length || 0);
    } else if (otherEnd <= ownOp.position) {
      // Other deletion comes before own, adjust own position
      transformedOwnOp.position = ownOp.position - (otherOp.length || 0);
    } else {
      // Overlapping deletions - conflict resolution needed
      conflict = true;
      const overlapStart = Math.max(ownOp.position, otherOp.position);
      const overlapEnd = Math.min(ownEnd, otherEnd);
      
      if (overlapStart < overlapEnd) {
        // Adjust lengths to avoid double deletion
        const overlapLength = overlapEnd - overlapStart;
        
        if (ownOp.position <= otherOp.position) {
          transformedOtherOp.position = ownOp.position;
          transformedOtherOp.length = (otherOp.length || 0) - overlapLength;
        } else {
          transformedOwnOp.position = otherOp.position;
          transformedOwnOp.length = (ownOp.length || 0) - overlapLength;
        }
      }
    }
  } else if (ownOp.type === 'insert' && otherOp.type === 'delete') {
    // Insert vs Delete
    const otherEnd = otherOp.position + (otherOp.length || 0);
    
    if (ownOp.position <= otherOp.position) {
      // Insert comes before delete, adjust delete position
      transformedOtherOp.position = otherOp.position + (ownOp.content?.length || 0);
    } else if (ownOp.position >= otherEnd) {
      // Insert comes after delete, adjust insert position
      transformedOwnOp.position = ownOp.position - (otherOp.length || 0);
    } else {
      // Insert is within delete range - conflict
      conflict = true;
      transformedOwnOp.position = otherOp.position;
    }
  } else if (ownOp.type === 'delete' && otherOp.type === 'insert') {
    // Delete vs Insert
    const ownEnd = ownOp.position + (ownOp.length || 0);
    
    if (otherOp.position <= ownOp.position) {
      // Insert comes before delete, adjust delete position
      transformedOwnOp.position = ownOp.position + (otherOp.content?.length || 0);
    } else if (otherOp.position >= ownEnd) {
      // Insert comes after delete, adjust insert position
      transformedOtherOp.position = otherOp.position - (ownOp.length || 0);
    } else {
      // Insert is within delete range - conflict
      conflict = true;
      transformedOtherOp.position = ownOp.position;
    }
  }
  
  return { ownOp: transformedOwnOp, otherOp: transformedOtherOp, conflict };
}

/**
 * Apply operations to reconstruct document text
 */
export function applyOperations(operations: CRDTOperation[], fieldType: 'title' | 'body'): string {
  // Sort operations by timestamp and sequence number for deterministic ordering
  const sortedOps = operations
    .filter(op => op.fieldType === fieldType)
    .sort((a, b) => {
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
      if (a.sequenceNumber !== b.sequenceNumber) return a.sequenceNumber - b.sequenceNumber;
      return a.clientId.localeCompare(b.clientId);
    });
  
  let text = '';
  
  for (const op of sortedOps) {
    try {
      if (op.type === 'insert' && op.content) {
        const pos = Math.max(0, Math.min(op.position, text.length));
        text = text.slice(0, pos) + op.content + text.slice(pos);
      } else if (op.type === 'delete' && op.length) {
        const pos = Math.max(0, Math.min(op.position, text.length));
        const endPos = Math.min(pos + op.length, text.length);
        text = text.slice(0, pos) + text.slice(endPos);
      }
    } catch (error) {
      console.error('Error applying operation:', op, error);
    }
  }
  
  return text;
}

/**
 * Merge operations from different sources with conflict resolution
 */
export function mergeOperations(
  localOps: CRDTOperation[],
  remoteOps: CRDTOperation[]
): CRDTOperation[] {
  const mergedOps: CRDTOperation[] = [];
  const processedIds = new Set<string>();
  
  // Combine all operations
  const allOps = [...localOps, ...remoteOps];
  
  // Sort by timestamp and sequence number
  allOps.sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    if (a.sequenceNumber !== b.sequenceNumber) return a.sequenceNumber - b.sequenceNumber;
    return a.clientId.localeCompare(b.clientId);
  });
  
  // Process operations in order, handling conflicts
  for (const op of allOps) {
    if (processedIds.has(op.id)) continue;
    
    // Transform against previously processed operations
    let transformedOp = { ...op };
    
    for (const existingOp of mergedOps) {
      if (existingOp.fieldType === op.fieldType) {
        const result = transformOperation(transformedOp, existingOp);
        transformedOp = result.ownOp;
      }
    }
    
    mergedOps.push(transformedOp);
    processedIds.add(op.id);
  }
  
  return mergedOps;
}

/**
 * Create a new CRDT document
 */
export function createCRDTDocument(initialText: string = ''): CRDTDocument {
  return {
    operations: [],
    currentText: initialText,
    version: 0,
    lastModified: Date.now()
  };
}

/**
 * Validate an operation
 */
export function validateOperation(op: CRDTOperation, currentText: string): boolean {
  try {
    if (op.type === 'insert') {
      return op.position >= 0 && op.position <= currentText.length && !!op.content;
    } else if (op.type === 'delete') {
      return op.position >= 0 && 
             op.position < currentText.length && 
             op.length! > 0 && 
             op.position + op.length! <= currentText.length;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Get document statistics
 */
export function getDocumentStats(doc: CRDTDocument): {
  totalOperations: number;
  insertions: number;
  deletions: number;
  textLength: number;
} {
  const stats = {
    totalOperations: doc.operations.length,
    insertions: 0,
    deletions: 0,
    textLength: doc.currentText.length
  };
  
  for (const op of doc.operations) {
    if (op.type === 'insert') stats.insertions++;
    else if (op.type === 'delete') stats.deletions++;
  }
  
  return stats;
} 
