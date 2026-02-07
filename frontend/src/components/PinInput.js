import { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';

/**
 * Reusable 6-Digit PIN Input Component with masking and visibility toggle
 * 
 * @param {string} value - Current PIN value
 * @param {function} onChange - Callback when PIN changes
 * @param {string} error - Error message to display
 * @param {string} label - Label text for the input
 * @param {string} testId - Base test ID for data-testid attributes
 * @param {boolean} autoFocus - Whether to auto-focus first input on mount
 */
const PinInput = ({ value, onChange, error, label, testId = 'pin', autoFocus = false }) => {
  const inputRefs = useRef([]);
  const [pins, setPins] = useState(['', '', '', '', '', '']);
  const [showPin, setShowPin] = useState(false);

  // Update parent value when pins change
  useEffect(() => {
    onChange(pins.join(''));
  }, [pins, onChange]);

  // If value is cleared externally, reset pins
  useEffect(() => {
    if (!value) {
      setPins(['', '', '', '', '', '']);
    }
  }, [value]);

  // Auto-focus first input on mount if autoFocus is true
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  const handleChange = (index, val) => {
    // Only allow numbers
    if (val && !/^\d$/.test(val)) return;

    const newPins = [...pins];
    newPins[index] = val;
    setPins(newPins);

    // Auto-focus next input
    if (val && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === 'Backspace') {
      if (!pins[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
    // Handle arrow keys
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newPins = [...pins];
    for (let i = 0; i < pastedData.length; i++) {
      newPins[i] = pastedData[i];
    }
    setPins(newPins);
    // Focus last filled or next empty
    const focusIndex = Math.min(pastedData.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  const toggleVisibility = () => {
    setShowPin(!showPin);
  };

  // Get display value for each digit
  const getDisplayValue = (pin, index) => {
    if (!pin) return '';
    return showPin ? pin : '•';
  };

  return (
    <div>
      {label && <Label className="mb-3 block text-sm font-medium text-gray-700">{label}</Label>}
      
      <div className="flex items-center gap-3 justify-center">
        {/* PIN Input Boxes */}
        <div className="flex gap-2">
          {pins.map((pin, index) => (
            <div key={index} className="relative">
              {/* Hidden actual input for capturing input */}
              <input
                ref={(el) => (inputRefs.current[index] = el)}
                type="tel"
                inputMode="numeric"
                maxLength={1}
                value={pin}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                className="absolute inset-0 w-full h-full z-10"
                style={{ opacity: 0, caretColor: 'transparent' }}
                data-testid={`${testId}-${index}`}
                autoComplete="off"
              />
              {/* Visual display box */}
              <div
                className={`w-12 h-14 flex items-center justify-center text-2xl font-bold rounded-xl border-2 transition-all cursor-pointer
                  ${error ? 'border-red-500 bg-red-50 animate-shake' : 'border-gray-200'}
                  ${pin ? 'bg-purple-50 border-purple-400' : 'bg-white'}
                  ${document.activeElement === inputRefs.current[index] ? 'border-purple-500 ring-2 ring-purple-200' : ''}
                `}
                onClick={() => inputRefs.current[index]?.focus()}
              >
                <span className={`${showPin ? 'text-gray-900' : 'text-purple-600'}`}>
                  {getDisplayValue(pin, index)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Eye Toggle Button */}
        <button
          type="button"
          onClick={toggleVisibility}
          className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-purple-300"
          data-testid={`${testId}-toggle-visibility`}
          aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
        >
          {showPin ? (
            <EyeOff className="h-5 w-5" />
          ) : (
            <Eye className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center justify-center gap-1 mt-2 text-red-600 text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default PinInput;
