// JSON Tabular Viewer Type Definitions

export interface JsonNode {
  key: string;
  value: any;
  type: 'object' | 'array' | 'primitive';
  path: string;
  parent?: JsonNode;
  children?: JsonNode[];
  isExpanded?: boolean;
}

export interface JsonTableSchema {
  id: string;
  name: string;
  path: string;
  primaryKey?: string;
  columns: JsonColumn[];
  data: JsonTableRow[];
  isArray: boolean;
  parentPath?: string;
  level: number;
}

export interface JsonColumn {
  id: string;
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
  path: string;
  isExpandable: boolean;
  isEditable: boolean;
  width?: number;
  sortable: boolean;
  filterable: boolean;
}

export interface JsonTableRow {
  id: string;
  data: Record<string, any>;
  isExpanded?: boolean;
  level: number;
  parentId?: string;
  children?: JsonTableRow[];
  _originalData?: any;
}

export interface JsonTab {
  id: string;
  name: string;
  path: string;
  schema: JsonTableSchema;
  isActive: boolean;
  level: number;
  parentTab?: string;
}

export interface JsonViewerState {
  tabs: JsonTab[];
  activeTab: string | null;
  expandedRows: Set<string>;
  selectedRows: Set<string>;
  editingCell: {
    rowId: string;
    columnId: string;
  } | null;
  loading: boolean;
  error: string | null;
}

export interface CrudOperation {
  type: 'create' | 'update' | 'delete';
  tableId: string;
  rowId?: string;
  columnId?: string;
  data?: any;
  oldValue?: any;
  newValue?: any;
}

export interface JsonViewerProps {
  fileName: string;
  data: any;
  onDataChange?: (data: any) => void;
  onSave?: (data: any) => Promise<void>;
  readOnly?: boolean;
  maxDepth?: number;
  autoDetectPrimaryKeys?: boolean;
}

// Utility types for table operations
export type TableAction = 'add' | 'edit' | 'delete' | 'expand' | 'collapse';
export type CellEditMode = 'text' | 'number' | 'boolean' | 'select' | 'json';

// Configuration for JSON parsing
export interface JsonParserConfig {
  maxDepth: number;
  autoDetectPrimaryKeys: boolean;
  primaryKeyCandidates: string[];
  excludeKeys: string[];
  arrayThreshold: number; // Minimum items to show as table
}

// Default configuration
export const DEFAULT_JSON_PARSER_CONFIG: JsonParserConfig = {
  maxDepth: 6,
  autoDetectPrimaryKeys: true,
  primaryKeyCandidates: ['id', 'ID', 'key', 'name', 'title', 'uuid'],
  excludeKeys: ['_version', '_created_at', '_updated_at'],
  arrayThreshold: 1,
};
