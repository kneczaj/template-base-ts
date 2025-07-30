import { join } from 'node:path';
import type { TypePolicies } from '@apollo/client';
import { describe } from 'vitest';
import codegen from '../codegen';
import { testGqlIds } from './test/gql/schemaIds';

describe('GraphQL Query ID Field Validation', () => {
  const typePolicies: TypePolicies = { User: { keyFields: ['email'] } };

  testGqlIds({
    rootDir: join(__dirname, '..'),
    schema: codegen.schema as string,
    typePolicies,
    documents: codegen.documents,
  });
});
