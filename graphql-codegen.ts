/* eslint-disable object-shorthand */
import { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  schema: './wasm/linera-protocol/linera-service-graphql-client/gql/*.graphql',
  generates: {
    './dist/__generated__/graphql/graphql.ts': {
      preset: 'client',
      plugins: []
    }
  }
}

export default config
