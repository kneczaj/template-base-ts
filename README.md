# Template
This is a React template with access to GraphQL API.

## Usage

### Add remote
Add this repo as `template` remote:
`git remote add template git@github.com:kneczaj/template-base-ts.git`

### Merge to the root directory
Merge template with `git merge --allow-unrelated-histories 
template/react-graphql`

### Merge to a subdirectory
If needed, it can be merged to a subdirectory/workspace.

To merge to a directory `client` run:
`git merge --allow-unrelated-histories -Xsubtree=client template/react-graphql`
