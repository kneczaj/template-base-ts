import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import type { TypePolicies } from '@apollo/client';
import type { Types } from '@graphql-codegen/plugin-helpers';
import { glob } from 'glob';
import {
  type DocumentNode,
  type FieldDefinitionNode,
  type FieldNode,
  type ObjectTypeDefinitionNode,
  parse,
  type ScalarTypeDefinitionNode,
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
  const fieldPath: string[] = [];
  const typeStack: string[] = [];

  visit(queryAST, {
    Field: {
      enter(node: FieldNode) {
        fieldPath.push(node.name.value);

        // Determine the type of this field using schema mapping
        const fieldType = fieldTypeMapping[node.name.value];
        if (fieldType) {
          typeStack.push(fieldType);
        }
      },
      leave() {
        fieldPath.pop();

        // Pop type stack if we added a type for this field
        const fieldName = fieldPath[fieldPath.length - 1];
        if (fieldName && fieldTypeMapping[fieldName]) {
          typeStack.pop();
        }
      },
    },
    SelectionSet(node: SelectionSetNode, _key, parent) {
      // Skip root query selection sets
      if (parent && 'kind' in parent && parent.kind === 'OperationDefinition') {
        return;
      }

      const currentType = typeStack[typeStack.length - 1];
      const typePolicy = currentType ? typePolicies[currentType] : null;
      const keyFields = typePolicy?.keyFields as string[] | undefined;

      const hasIdField = node.selections.some((selection) => {
        return selection.kind === 'Field' && selection.name.value === 'id';
      });

      const hasAlternativeKeyFields = keyFields
        ? keyFields.some((keyField) =>
            node.selections.some(
              (selection) => selection.kind === 'Field' && selection.name.value === keyField,
            ),
          )
        : false;

      const hasFields = node.selections.some((selection) => selection.kind === 'Field');

      if (hasFields && !hasIdField && !hasAlternativeKeyFields) {
        missingIdFields.push(fieldPath.join('.'));
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
