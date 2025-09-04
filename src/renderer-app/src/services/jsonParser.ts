import {
  JsonNode,
  JsonTableSchema,
  JsonColumn,
  JsonTableRow,
  JsonTab,
  JsonParserConfig,
  DEFAULT_JSON_PARSER_CONFIG,
} from '../types/jsonViewer';

export class JsonParserService {
  private config: JsonParserConfig;

  constructor(config: Partial<JsonParserConfig> = {}) {
    this.config = { ...DEFAULT_JSON_PARSER_CONFIG, ...config };
  }

  /**
   * Parse JSON data and generate tabular structure
   */
  parseJsonToTabs(data: any, fileName: string): JsonTab[] {
    const rootNode = this.createJsonNode('root', data, '');
    const tabs: JsonTab[] = [];

    // Find top-level objects and arrays that can become tables
    const topLevelNodes = this.findTableCandidates(rootNode, 0);
    
    for (const node of topLevelNodes) {
      const schema = this.generateTableSchema(node, fileName);
      if (schema) {
        tabs.push({
          id: schema.id,
          name: this.formatTabName(node.key),
          path: node.path,
          schema,
          isActive: tabs.length === 0, // First tab is active by default
          level: 0,
        });
      }
    }

    return tabs;
  }

  /**
   * Create a JsonNode from a value
   */
  private createJsonNode(key: string, value: any, path: string, parent?: JsonNode): JsonNode {
    const node: JsonNode = {
      key,
      value,
      type: this.getNodeType(value),
      path: path ? `${path}.${key}` : key,
      parent,
    };

    if (node.type === 'object' && value && typeof value === 'object') {
      node.children = Object.entries(value).map(([childKey, childValue]) =>
        this.createJsonNode(childKey, childValue, node.path, node)
      );
    } else if (node.type === 'array' && Array.isArray(value)) {
      node.children = value.map((item, index) =>
        this.createJsonNode(index.toString(), item, node.path, node)
      );
    }

    return node;
  }

  /**
   * Determine the type of a JSON value
   */
  private getNodeType(value: any): 'object' | 'array' | 'primitive' {
    if (Array.isArray(value)) return 'array';
    if (value && typeof value === 'object') return 'object';
    return 'primitive';
  }

  /**
   * Find nodes that can become tables
   */
  private findTableCandidates(node: JsonNode, level: number): JsonNode[] {
    const candidates: JsonNode[] = [];

    if (level >= this.config.maxDepth) return candidates;

    // If this is an array with objects, it's a table candidate
    if (node.type === 'array' && node.children && node.children.length > 0) {
      const firstChild = node.children[0];
      if (firstChild.type === 'object' && node.children.length >= this.config.arrayThreshold) {
        candidates.push(node);
      }
    }

    // If this is an object, check its children
    if (node.type === 'object' && node.children) {
      for (const child of node.children) {
        candidates.push(...this.findTableCandidates(child, level + 1));
      }
    }

    return candidates;
  }

  /**
   * Generate table schema from a JsonNode
   */
  private generateTableSchema(node: JsonNode, fileName: string): JsonTableSchema | null {
    if (node.type !== 'array' || !node.children || node.children.length === 0) {
      return null;
    }

    // Get the first object to determine columns
    const firstObject = node.children[0];
    if (firstObject.type !== 'object' || !firstObject.children) {
      return null;
    }

    // Generate columns from the first object
    const columns: JsonColumn[] = firstObject.children.map((child) => ({
      id: child.key,
      key: child.key,
      label: this.formatColumnLabel(child.key),
      type: this.getColumnType(child.value),
      path: child.path,
      isExpandable: child.type === 'object' || child.type === 'array',
      isEditable: this.isEditable(child.value),
      sortable: this.isSortable(child.value),
      filterable: this.isFilterable(child.value),
    }));

    // Detect primary key
    const primaryKey = this.detectPrimaryKey(columns);

    // Generate table data
    const data: JsonTableRow[] = node.children.map((child, index) => ({
      id: this.generateRowId(child, index),
      data: this.flattenObject(child),
      level: 0,
      _originalData: child.value,
    }));

    return {
      id: `${fileName}_${node.path.replace(/\./g, '_')}`,
      name: this.formatTabName(node.key),
      path: node.path,
      primaryKey,
      columns,
      data,
      isArray: true,
      level: 0,
    };
  }

  /**
   * Detect primary key from columns
   */
  private detectPrimaryKey(columns: JsonColumn[]): string | undefined {
    if (!this.config.autoDetectPrimaryKeys) return undefined;

    // Look for common primary key patterns
    for (const candidate of this.config.primaryKeyCandidates) {
      const column = columns.find(col => 
        col.key.toLowerCase() === candidate.toLowerCase() ||
        col.key.toLowerCase().includes(candidate.toLowerCase())
      );
      if (column) return column.key;
    }

    // If no common pattern found, use the first string column
    const stringColumn = columns.find(col => col.type === 'string');
    return stringColumn?.key;
  }

  /**
   * Generate row ID
   */
  private generateRowId(node: JsonNode, index: number): string {
    if (node.type === 'object' && node.children) {
      // Try to find an ID field
      const idField = node.children.find(child => 
        this.config.primaryKeyCandidates.some(pk => 
          child.key.toLowerCase().includes(pk.toLowerCase())
        )
      );
      if (idField) return String(idField.value);
    }
    return `row_${index}`;
  }

  /**
   * Flatten an object for table display
   */
  private flattenObject(node: JsonNode): Record<string, any> {
    const result: Record<string, any> = {};

    if (node.type === 'object' && node.children) {
      for (const child of node.children) {
        if (child.type === 'primitive') {
          result[child.key] = child.value;
        } else if (child.type === 'object') {
          result[child.key] = `{${Object.keys(child.value || {}).length} properties}`;
        } else if (child.type === 'array') {
          result[child.key] = `[${child.children?.length || 0} items]`;
        }
      }
    } else if (node.type === 'primitive') {
      result[node.key] = node.value;
    }

    return result;
  }

  /**
   * Get column type for a value
   */
  private getColumnType(value: any): 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    return 'string';
  }

  /**
   * Check if a value is editable
   */
  private isEditable(value: any): boolean {
    return value === null || 
           typeof value === 'string' || 
           typeof value === 'number' || 
           typeof value === 'boolean';
  }

  /**
   * Check if a value is sortable
   */
  private isSortable(value: any): boolean {
    return typeof value === 'string' || 
           typeof value === 'number' || 
           typeof value === 'boolean';
  }

  /**
   * Check if a value is filterable
   */
  private isFilterable(value: any): boolean {
    return typeof value === 'string' || 
           typeof value === 'number' || 
           typeof value === 'boolean';
  }

  /**
   * Format tab name
   */
  private formatTabName(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * Format column label
   */
  private formatColumnLabel(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]/g, ' ')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<JsonParserConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): JsonParserConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const jsonParserService = new JsonParserService();
