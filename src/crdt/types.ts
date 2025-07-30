export interface CRDTOperation {
  id: string;
  type: 'insert' | 'delete' | 'retain';
  position: number;
  content?: string;
  length?: number;
  timestamp: number;
  author: string;
  noteId: string;
  fieldType: 'title' | 'body';
  clientId: string;
  sequenceNumber: number;
}

export interface CRDTDocument {
  operations: CRDTOperation[];
  currentText: string;
  version: number;
  lastModified: number;
}

export interface CRDTNote {
  id: number;
  localId?: string;
  titleDocument: CRDTDocument;
  bodyDocument: CRDTDocument;
  created_at?: string;
  updated_at?: string;
  isDirty?: boolean;
  isLocalOnly?: boolean;
  lastSyncedVersion?: number;
  conflictResolutionNeeded?: boolean;
}

export interface PendingCRDTSave {
  noteId: string;
  operations: CRDTOperation[];
  timestamp: number;
  version: number;
}

export interface TextChange {
  type: 'insert' | 'delete' | 'replace';
  position: number;
  content?: string;
  deletedContent?: string;
  length?: number;
}

export interface CRDTState {
  clientId: string;
  sequenceCounter: number;
  pendingOperations: Map<string, CRDTOperation[]>;
  acknowledgedOperations: Set<string>;
}

export interface TransformResult {
  ownOp: CRDTOperation;
  otherOp: CRDTOperation;
  conflict: boolean;
} 
