import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  Container,
  SelectorRow,
  CalendarIcon,
  DaysGrid,
  DayCell,
  InfoContainer,
  InfoText,
  ResetButton,
  ErrorPopup,
  ErrorIcon,
  ErrorMessage,
} from './SearchScheduleSelector.styles';
import type {
  Day,
  SearchScheduleSelectorProps,
  ValidationResult,
} from './types';

/**
 * Days of the week constant - Starting with Sunday (S, M, T, W, T, F, S)
 */
const DAYS_OF_WEEK: Day[] = [
  { id: '1', singleLetter: 'S', fullName: 'Sunday', index: 0 },
  { id: '2', singleLetter: 'M', fullName: 'Monday', index: 1 },
  { id: '3', singleLetter: 'T', fullName: 'Tuesday', index: 2 },
  { id: '4', singleLetter: 'W', fullName: 'Wednesday', index: 3 },
  { id: '5', singleLetter: 'T', fullName: 'Thursday', index: 4 },
  { id: '6', singleLetter: 'F', fullName: 'Friday', index: 5 },
  { id: '7', singleLetter: 'S', fullName: 'Saturday', index: 6 },
];

/**
 * SearchScheduleSelector Component
 *
 * A weekly schedule selector for split-lease arrangements.
 * Allows users to select 2-5 contiguous nights per week.
 *
 * @example
 * ```tsx
 * <SearchScheduleSelector
 *   onSelectionChange={(days) => console.log(days)}
 *   onError={(error) => console.error(error)}
 * />
 * ```
 */
export const SearchScheduleSelector: React.FC<SearchScheduleSelectorProps> = ({
  onSelectionChange,
  onError,
  className,
  minDays = 3,
  requireContiguous = true,
  initialSelection = [],
}) => {
  const [selectedDays, setSelectedDays] = useState<Set<number>>(
    new Set(initialSelection)
  );
  const [isDragging, setIsDragging] = useState(false);
  const [mouseDownIndex, setMouseDownIndex] = useState<number | null>(null);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [hasContiguityError, setHasContiguityError] = useState(false);
  const [validationTimeout, setValidationTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [errorTimeout, setErrorTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [checkinDay, setCheckinDay] = useState<string>('');
  const [checkoutDay, setCheckoutDay] = useState<string>('');

  /**
   * Check if selected days are contiguous (handles wrap-around)
   * Uses the exact logic from index_lite page
   * Example: [5, 6, 0, 1, 2] (Fri, Sat, Sun, Mon, Tue) is contiguous
   */
  const isContiguous = useCallback((days: Set<number>): boolean => {
    const daysArray = Array.from(days);

    // Edge cases
    if (daysArray.length <= 1) {
      return true;
    }

    if (daysArray.length >= 6) {
      return true;
    }

    const sortedDays = [...daysArray].sort((a, b) => a - b);

    // STEP 1: Check if selected days are continuous (regular check)
    let isRegularContinuous = true;
    for (let i = 1; i < sortedDays.length; i++) {
      if (sortedDays[i] !== sortedDays[i - 1] + 1) {
        isRegularContinuous = false;
        break;
      }
    }

    if (isRegularContinuous) {
      return true;
    }

    // STEP 2: Check if UNSELECTED days are continuous (implies wrap-around)
    const allDays = [0, 1, 2, 3, 4, 5, 6];
    const unselectedDays = allDays.filter(day => !sortedDays.includes(day));

    if (unselectedDays.length === 0) {
      // All days selected
      return true;
    }

    // Check if unselected days are continuous
    const sortedUnselected = [...unselectedDays].sort((a, b) => a - b);
    for (let i = 1; i < sortedUnselected.length; i++) {
      if (sortedUnselected[i] !== sortedUnselected[i - 1] + 1) {
        // Unselected days not continuous, selection is not valid
        return false;
      }
    }

    // Unselected days are continuous, selection wraps around!
    return true;
  }, []);

  /**
   * Validate the current selection
   * NOTE: Nights = Days - 1 (last day is checkout, doesn't count as a night)
   */
  const validateSelection = useCallback(
    (days: Set<number>): ValidationResult => {
      const dayCount = days.size;
      const nightCount = dayCount - 1; // Checkout day doesn't count as a night

      if (dayCount === 0) {
        return { valid: true };
      }

      // Need at least minDays + 1 days to have minDays nights
      // Example: 2 nights requires 3 days (check-in + 2 nights + checkout)
      if (nightCount < minDays) {
        return {
          valid: false,
          error: `Please select at least ${minDays} night${minDays > 1 ? 's' : ''} per week`,
        };
      }

      if (requireContiguous && !isContiguous(days)) {
        return {
          valid: false,
          error: 'Please select contiguous days (e.g., Mon-Tue-Wed, not Mon-Wed-Fri)',
        };
      }

      return { valid: true };
    },
    [minDays, requireContiguous, isContiguous]
  );

  /**
   * Display error message
   */
  const displayError = useCallback(
    (error: string) => {
      // Clear any existing error timeout
      if (errorTimeout) {
        clearTimeout(errorTimeout);
      }

      setErrorMessage(error);
      setShowError(true);

      // Hide error after 6 seconds
      const timeout = setTimeout(() => {
        setShowError(false);
      }, 6000);

      setErrorTimeout(timeout);

      if (onError) {
        onError(error);
      }
    },
    [onError, errorTimeout]
  );

  /**
   * Handle mouse down - Start tracking for click vs drag
   */
  const handleMouseDown = useCallback((dayIndex: number) => {
    setMouseDownIndex(dayIndex);
  }, []);

  /**
   * Handle mouse enter - If dragging, fill range
   */
  const handleMouseEnter = useCallback(
    (dayIndex: number) => {
      // Only drag if mouse is down and we moved to a different cell
      if (mouseDownIndex !== null && dayIndex !== mouseDownIndex) {
        setIsDragging(true);

        const newSelection = new Set<number>();
        const totalDays = 7;
        const start = mouseDownIndex;

        // Calculate range with wrap-around
        let dayCount;
        if (dayIndex >= start) {
          dayCount = dayIndex - start + 1;
        } else {
          dayCount = (totalDays - start) + dayIndex + 1;
        }

        // Fill all days in range
        for (let i = 0; i < dayCount; i++) {
          const currentDay = (start + i) % totalDays;
          newSelection.add(currentDay);
        }

        setSelectedDays(newSelection);
      }
    },
    [mouseDownIndex]
  );

  /**
   * Handle mouse up - Determine if click or drag, then act accordingly
   */
  const handleMouseUp = useCallback(
    (dayIndex: number) => {
      if (mouseDownIndex === null) return;

      // Check if this was a click (same cell) or drag (different cell)
      if (!isDragging && dayIndex === mouseDownIndex) {
        // CLICK - Toggle the day
        setSelectedDays(prev => {
          const newSelection = new Set(prev);

          if (newSelection.has(dayIndex)) {
            // Check if removing this day would go below minimum nights
            // After removal: (size - 1) days, which gives (size - 1 - 1) = (size - 2) nights
            const daysAfterRemoval = newSelection.size - 1;
            const nightsAfterRemoval = daysAfterRemoval - 1; // Checkout day doesn't count
            if (nightsAfterRemoval < minDays) {
              // Prevent removal and show error
              displayError(`Cannot remove day - you must select at least ${minDays} night${minDays > 1 ? 's' : ''} per week`);
              return prev; // Return unchanged selection
            }
            newSelection.delete(dayIndex);
          } else {
            newSelection.add(dayIndex);
          }

          // Clear existing validation timeout
          if (validationTimeout) {
            clearTimeout(validationTimeout);
          }

          // Schedule validation after 3 seconds of inactivity
          const timeout = setTimeout(() => {
            // Only validate if selection is invalid
            const validation = validateSelection(newSelection);
            if (!validation.valid && validation.error) {
              displayError(validation.error);
            }
          }, 3000);

          setValidationTimeout(timeout);

          return newSelection;
        });
      } else if (isDragging) {
        // DRAG - Validate immediately
        const validation = validateSelection(selectedDays);
        if (!validation.valid && validation.error) {
          displayError(validation.error);
          setSelectedDays(new Set());
        }
      }

      // Reset drag state
      setIsDragging(false);
      setMouseDownIndex(null);
    },
    [isDragging, mouseDownIndex, selectedDays, validationTimeout, validateSelection, displayError]
  );

  /**
   * Handle reset - clear all selections
   */
  const handleReset = useCallback(() => {
    setSelectedDays(new Set());
    if (validationTimeout) {
      clearTimeout(validationTimeout);
      setValidationTimeout(null);
    }
    if (errorTimeout) {
      clearTimeout(errorTimeout);
      setErrorTimeout(null);
    }
    setShowError(false);
  }, [validationTimeout, errorTimeout]);

  /**
   * Calculate check-in and check-out days based on selection
   * Uses the exact logic from index_lite page
   */
  const calculateCheckinCheckout = useCallback((days: Set<number>) => {
    if (days.size === 0) {
      setCheckinDay('');
      setCheckoutDay('');
      return;
    }

    if (!isContiguous(days)) {
      setCheckinDay('');
      setCheckoutDay('');
      return;
    }

    const selectedDaysArray = Array.from(days);

    // Single day selection
    if (selectedDaysArray.length === 1) {
      setCheckinDay(DAYS_OF_WEEK[selectedDaysArray[0]].fullName);
      setCheckoutDay(DAYS_OF_WEEK[selectedDaysArray[0]].fullName);
      return;
    }

    // Multiple day selection
    const sortedDays = [...selectedDaysArray].sort((a, b) => a - b);
    const hasSunday = sortedDays.includes(0);
    const hasSaturday = sortedDays.includes(6);

    // Check if this is a wrap-around case
    if (hasSunday && hasSaturday && sortedDays.length < 7) {
      // Find the gap (unselected days) in the week
      let gapStart = -1;
      let gapEnd = -1;

      // Look for the gap in the sorted days
      for (let i = 0; i < sortedDays.length - 1; i++) {
        if (sortedDays[i + 1] - sortedDays[i] > 1) {
          // Found the gap
          gapStart = sortedDays[i] + 1;  // First unselected day
          gapEnd = sortedDays[i + 1] - 1;  // Last unselected day
          break;
        }
      }

      if (gapStart !== -1 && gapEnd !== -1) {
        // Wrap-around case with a gap in the middle
        // Check-in: First selected day AFTER the gap ends
        // Check-out: Last selected day BEFORE the gap starts

        // Check-in is the smallest day after the gap (considering wrap)
        let checkinDayIndex: number;
        if (sortedDays.some(day => day > gapEnd)) {
          // There are days after the gap in the same week
          checkinDayIndex = sortedDays.find(day => day > gapEnd)!;
        } else {
          // Wrap to Sunday
          checkinDayIndex = 0;
        }

        // Check-out is the largest day before the gap
        let checkoutDayIndex: number;
        if (sortedDays.some(day => day < gapStart)) {
          // There are days before the gap
          checkoutDayIndex = sortedDays.filter(day => day < gapStart).pop()!;
        } else {
          // Wrap to Saturday
          checkoutDayIndex = 6;
        }

        setCheckinDay(DAYS_OF_WEEK[checkinDayIndex].fullName);
        setCheckoutDay(DAYS_OF_WEEK[checkoutDayIndex].fullName);
      } else {
        // No gap found (shouldn't happen with Sunday and Saturday selected)
        // Use standard min/max
        setCheckinDay(DAYS_OF_WEEK[sortedDays[0]].fullName);
        setCheckoutDay(DAYS_OF_WEEK[sortedDays[sortedDays.length - 1]].fullName);
      }
    } else {
      // Non-wrap-around case: use first and last in sorted order
      setCheckinDay(DAYS_OF_WEEK[sortedDays[0]].fullName);
      setCheckoutDay(DAYS_OF_WEEK[sortedDays[sortedDays.length - 1]].fullName);
    }
  }, [isContiguous]);

  /**
   * Update parent component on selection change
   * Also check for contiguity errors in real-time
   */
  useEffect(() => {
    if (onSelectionChange) {
      const selectedDaysArray = Array.from(selectedDays).map(
        index => DAYS_OF_WEEK[index]
      );
      onSelectionChange(selectedDaysArray);
    }

    // Calculate check-in/check-out
    calculateCheckinCheckout(selectedDays);

    // Check for contiguity error (visual feedback + immediate alert)
    if (selectedDays.size > 1 && requireContiguous) {
      const isValid = isContiguous(selectedDays);
      const wasContiguousError = hasContiguityError;
      setHasContiguityError(!isValid);

      // Show contiguity error immediately only if it's a NEW error (wasn't already showing)
      if (!isValid && !wasContiguousError && !showError) {
        displayError('Please select contiguous days (e.g., Mon-Tue-Wed, not Mon-Wed-Fri)');
      }
    } else {
      setHasContiguityError(false);
      // Hide error if selection becomes valid
      if (showError) {
        setShowError(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDays]);


  return (
    <Container className={className}>
      <SelectorRow>
        <CalendarIcon>📅</CalendarIcon>

        <DaysGrid>
          {DAYS_OF_WEEK.map((day, index) => (
            <DayCell
              key={day.id}
              $isSelected={selectedDays.has(index)}
              $isDragging={isDragging}
              $hasError={hasContiguityError}
              $errorStyle={1}
              onMouseDown={(e) => {
                e.preventDefault();
                handleMouseDown(index);
              }}
              onMouseEnter={() => handleMouseEnter(index)}
              onMouseUp={() => handleMouseUp(index)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
              role="button"
              aria-pressed={selectedDays.has(index)}
              aria-label={`Select ${day.fullName}`}
            >
              {day.singleLetter}
            </DayCell>
          ))}
        </DaysGrid>
      </SelectorRow>

      <InfoContainer>
        {selectedDays.size > 0 && checkinDay && checkoutDay && (
          <>
            <InfoText>
              <strong>Check-in:</strong> {checkinDay} • <strong>Check-out:</strong> {checkoutDay}
            </InfoText>
            <ResetButton onClick={handleReset}>Clear selection</ResetButton>
          </>
        )}
      </InfoContainer>

      <AnimatePresence>
        {showError && (
          <ErrorPopup
            initial={{ opacity: 0, scale: 0.8, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <ErrorIcon>⚠️</ErrorIcon>
            <ErrorMessage>{errorMessage}</ErrorMessage>
          </ErrorPopup>
        )}
      </AnimatePresence>
    </Container>
  );
};

export default SearchScheduleSelector;
