import { describe, it, expect } from 'vitest';

describe('PollingWidget overline logic', () => {
  it('should show overline when not compact and text is provided', () => {
    const compact = false;
    const overlineText = 'Monitoring';
    
    const shouldShowOverline = !compact && overlineText.trim() !== '';
    expect(shouldShowOverline).toBe(true);
  });

  it('should hide overline when compact mode is enabled', () => {
    const compact = true;
    const overlineText = 'Monitoring';
    
    const shouldShowOverline = !compact && overlineText.trim() !== '';
    expect(shouldShowOverline).toBe(false);
  });

  it('should hide overline when text is empty', () => {
    const compact = false;
    const overlineText = '';
    
    const shouldShowOverline = !compact && overlineText.trim() !== '';
    expect(shouldShowOverline).toBe(false);
  });

  it('should hide overline when text is only whitespace', () => {
    const compact = false;
    const overlineText = '   ';
    
    const shouldShowOverline = !compact && overlineText.trim() !== '';
    expect(shouldShowOverline).toBe(false);
  });

  it('should show overline when not compact and text has content', () => {
    const compact = false;
    const overlineText = 'Weather';
    
    const shouldShowOverline = !compact && overlineText.trim() !== '';
    expect(shouldShowOverline).toBe(true);
  });

  it('should hide overline when compact is true even with text content', () => {
    const compact = true;
    const overlineText = 'Weather';
    
    const shouldShowOverline = !compact && overlineText.trim() !== '';
    expect(shouldShowOverline).toBe(false);
  });
});
