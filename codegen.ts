import { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: 'src/schema.gql',
  documents: ['src/app/**/*.gql'],
  emitLegacyCommonJSImports: true,
  verbose: true,
  generates: {
    './src/generated/graphql.ts': {
      plugins: ['typescript', 'typescript-operations', 'typescript-react-apollo'],
      config: {
        withHooks: true,
        withHOC: false,
        withComponent: false,
        defaultScalarType: 'unknown',
      },
    },
  },
  hooks: {
    afterOneFileWrite: ['biome check --write'],
  },
};

export default config;
