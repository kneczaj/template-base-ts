import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('node', () => {
  it('lists files', () => {
    expect(fs.readdirSync('.').length).toBeTruthy();
  });
});
