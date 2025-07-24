# Code style

## Typescript & Javascript

### Immutability
1. Always use immutable methods
2. Immutability has priority over performance

### Functional programming
1. For arrays operations always prefer map, filter, reduce over for loops
2. For side effects and only then forEach() is possible

### Typing
1. Arrays are never optional. If no data, then this property has empty array 
   value

### Unit tests
1. All mocks are placed in `mocks.ts` file in the same directory as the test
   file. This is also about results.
2. All mocks should be typed.
3. Mocks are imported to test file with `import * as MOCKS from './mocks.ts`.
