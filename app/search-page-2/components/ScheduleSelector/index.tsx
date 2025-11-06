import React from 'react';
import ReactDOM from 'react-dom/client';
import { SearchScheduleSelector } from './SearchScheduleSelector';
import type { SearchScheduleSelectorProps, Day } from './types';

/**
 * Mount the SearchScheduleSelector component to a DOM element
 *
 * @param elementId - The ID of the DOM element to mount to
 * @param props - Props to pass to the SearchScheduleSelector component
 * @returns The React root instance
 *
 * @example
 * ```typescript
 * mountScheduleSelector('schedule-selector-root', {
 *   initialSelection: [1, 2, 3, 4, 5], // Monday-Friday
 *   onSelectionChange: (days) => {
 *     console.log('Selected days:', days);
 *   },
 *   onError: (error) => {
 *     console.error('Validation error:', error);
 *   }
 * });
 * ```
 */
export function mountScheduleSelector(
  elementId: string,
  props?: SearchScheduleSelectorProps
) {
  const container = document.getElementById(elementId);

  if (!container) {
    console.error(`Element with ID "${elementId}" not found`);
    return null;
  }

  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <SearchScheduleSelector {...props} />
    </React.StrictMode>
  );

  return root;
}

// Export types for use in integration
export type { Day, SearchScheduleSelectorProps };
export { SearchScheduleSelector };

// Make mountScheduleSelector available globally for use in HTML
if (typeof window !== 'undefined') {
  (window as any).ScheduleSelector = {
    mount: mountScheduleSelector,
  };
}
