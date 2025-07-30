import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import type { TypePolicies } from '@apollo/client';
import type { Types } from '@graphql-codegen/plugin-helpers';
import { glob } from 'glob';
import {
  type DocumentNode,
  type FieldDefinitionNode,
  type FieldNode,
  type FragmentDefinitionNode,
  type ObjectTypeDefinitionNode,
  parse,
  type ScalarTypeDefinitionNode,
  type SelectionNode,
  type SelectionSetNode,
  type TypeNode,
  visit,
} from 'graphql';
import { expect, test } from 'vitest';

interface FieldTypeMapping {
  [fieldName: string]: string;
}

function extractTypeFromNode(typeNode: TypeNode): string {
  if (typeNode.kind === 'NonNullType') {
    return extractTypeFromNode(typeNode.type);
  }
  if (typeNode.kind === 'ListType') {
    return extractTypeFromNode(typeNode.type);
  }
  return typeNode.name.value;
}

export function parseSchema(schemaContent: string): FieldTypeMapping {
  const schemaAST = parse(schemaContent);
  const fieldTypeMapping: FieldTypeMapping = {};

  // Collect all scalar types (built-in + custom)
  const scalarTypes = new Set(['String', 'Int', 'Float', 'Boolean', 'ID']);

  visit(schemaAST, {
    ScalarTypeDefinition(node: ScalarTypeDefinitionNode) {
      scalarTypes.add(node.name.value);
    },
  });

  visit(schemaAST, {
    ObjectTypeDefinition(node: ObjectTypeDefinitionNode) {
      if (!node.fields) return;

      node.fields.forEach((field: FieldDefinitionNode) => {
        const fieldType = extractTypeFromNode(field.type);

        // Skip scalar types and focus on object types
        if (scalarTypes.has(fieldType)) {
          return;
        }

        fieldTypeMapping[field.name.value] = fieldType;
      });
    },
  });

  return fieldTypeMapping;
}

function findGqlFiles(
  rootDir: string,
  documents: Types.InstanceOrArray<Types.OperationDocument>,
): string[] {
  const documentPatterns = Array.isArray(documents) ? documents : [documents];

  return documentPatterns.flatMap((pattern) => {
    const patternStr = typeof pattern === 'string' ? pattern : pattern.toString();
    const absolutePattern = resolve(rootDir, patternStr);
    return glob.sync(absolutePattern);
  });
}

export function findMissingIds(
  queryAST: DocumentNode,
  fieldTypeMapping: FieldTypeMapping,
  typePolicies: TypePolicies,
): string[] {
  const missingIdFields: string[] = [];
  const fragments: Record<string, FragmentDefinitionNode> = {};

  // First, collect all fragment definitions
  visit(queryAST, {
    FragmentDefinition(node: FragmentDefinitionNode) {
      fragments[node.name.value] = node;
    },
  });

  function processSelectionSet(selectionSet: SelectionSetNode, fieldPath: string[]): void {
    // Get the current field type if we're in a nested field
    const currentFieldName = fieldPath[fieldPath.length - 1];
    const currentType = currentFieldName ? fieldTypeMapping[currentFieldName] : null;
    const typePolicy = currentType ? typePolicies[currentType] : null;
    const keyFields = typePolicy?.keyFields as string[] | undefined;

    // Process all selections, expanding fragments
    function expandSelection(selection: SelectionNode): SelectionNode[] {
      if (selection.kind === 'FragmentSpread') {
        const fragment = fragments[selection.name.value];
        if (fragment) {
          return fragment.selectionSet.selections.flatMap(expandSelection);
        }
        return [];
      } else if (selection.kind === 'InlineFragment') {
        return selection.selectionSet.selections.flatMap(expandSelection);
      }
      return [selection];
    }

    const expandedSelections = selectionSet.selections.flatMap(expandSelection);
    const fieldSelections = expandedSelections.filter(
      (selection): selection is FieldNode => selection.kind === 'Field',
    );

    const hasFields = fieldSelections.length > 0;
    const hasIdField = fieldSelections.some((selection) => selection.name.value === 'id');
    const hasAlternativeKeyFields = keyFields
      ? fieldSelections.some((selection) => keyFields.includes(selection.name.value))
      : false;

    // If this selection set represents an object type and is missing ID/key fields
    if (hasFields && !hasIdField && !hasAlternativeKeyFields && fieldPath.length > 0) {
      missingIdFields.push(fieldPath.join('.'));
    }

    // Recursively process nested selection sets
    fieldSelections
      .filter((selection) => selection.selectionSet)
      .forEach((selection) => {
        const fieldType = fieldTypeMapping[selection.name.value];
        if (fieldType && selection.selectionSet) {
          processSelectionSet(selection.selectionSet, [...fieldPath, selection.name.value]);
        }
      });
  }

  visit(queryAST, {
    OperationDefinition(node) {
      if (node.selectionSet) {
        // Process each top-level field
        node.selectionSet.selections.forEach((selection) => {
          if (selection.kind === 'Field' && selection.selectionSet) {
            processSelectionSet(selection.selectionSet, [selection.name.value]);
          }
        });
      }
    },
  });

  return missingIdFields;
}

export interface Props extends Pick<Types.Config, 'documents'> {
  rootDir: string;
  schema: string;
  typePolicies: TypePolicies;
}

export function testGqlIds({ rootDir, schema, documents = [], typePolicies }: Props) {
  const schemaContent = readFileSync(schema, 'utf-8');
  const fieldTypeMapping = parseSchema(schemaContent);

  const gqlFiles = findGqlFiles(rootDir, documents).filter((path) => path !== schema);
  gqlFiles.forEach((filePath) => {
    test(relative(rootDir, filePath), () => {
      const content = readFileSync(filePath, 'utf-8');
      const ast: DocumentNode = parse(content);
      expect(ast).toBeDefined();
      expect(ast.kind).toBe('Document');
      expect(findMissingIds(ast, fieldTypeMapping, typePolicies)).toEqual([]);
    });
  });
}
