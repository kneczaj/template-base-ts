import { beforeEach, describe, expect, it, vi } from 'vitest';
import { main } from './index';

describe('main', () => {
  const spies = {
    log: vi.spyOn(console, 'log'),
  };
  beforeEach(() => {
    spies.log.mockImplementation(vi.fn());
  });
  it('calls with log function', () => {
    main();
    expect(spies.log).toHaveBeenCalledWith('Hello');
  });
});
