/**
 * Represents a day of the week
 */
export interface Day {
  id: string;
  singleLetter: string;
  fullName: string;
  index: number;
}

/**
 * Represents a listing (property/accommodation)
 */
export interface Listing {
  id: string;
  // Add other listing properties as needed based on your data model
  title?: string;
  availableDays?: number[];
}

/**
 * Props for the SearchScheduleSelector component
 */
export interface SearchScheduleSelectorProps {
  /** Optional listing data to filter against */
  listing?: Listing;

  /** Callback fired when the selection changes */
  onSelectionChange?: (selectedDays: Day[]) => void;

  /** Callback fired when a validation error occurs */
  onError?: (error: string) => void;

  /** Custom styling class name */
  className?: string;

  /** Minimum number of days that can be selected */
  minDays?: number;

  /** Maximum number of days that can be selected */
  maxDays?: number;

  /** Whether to require contiguous day selection */
  requireContiguous?: boolean;

  /** Initial selected days (array of day indices 0-6) */
  initialSelection?: number[];
}

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Listing count data
 */
export interface ListingCount {
  exact: number;
  partial: number;
}
