/**
 * Generates a unique friend code
 * Format: 6-8 character alphanumeric code (uppercase letters and numbers)
 */
export const generateFriendCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const codeLength = 6;
  let code = '';

  for (let i = 0; i < codeLength; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return code;
};

/**
 * Sanitize and validate a friend code input
 * @param input Raw input string
 * @returns Object with sanitized code and validation result
 */
export const sanitizeFriendCode = (input: string): { code: string; isValid: boolean; error?: string } => {
  if (!input || typeof input !== 'string') {
    return { code: '', isValid: false, error: 'Input is required' };
  }

  // Remove whitespace and convert to uppercase
  const sanitized = input.trim().toUpperCase();

  // Check length
  if (sanitized.length !== 6) {
    return {
      code: sanitized,
      isValid: false,
      error: `Friend code must be exactly 6 characters (you entered ${sanitized.length})`
    };
  }

  // Check format (only uppercase letters and numbers)
  if (!/^[A-Z0-9]{6}$/.test(sanitized)) {
    return {
      code: sanitized,
      isValid: false,
      error: 'Friend code can only contain letters and numbers'
    };
  }

  return { code: sanitized, isValid: true };
};

// Test function for development (can be removed in production)
export const testFriendCodeValidation = () => {
  const testCases = [
    { input: 'ABC123', expected: true },
    { input: 'abc123', expected: true }, // Should be converted to uppercase
    { input: ' ABC123 ', expected: true }, // Should trim whitespace
    { input: 'ABC12', expected: false }, // Too short
    { input: 'ABC1234', expected: false }, // Too long
    { input: 'ABC12!', expected: false }, // Invalid character
    { input: '', expected: false }, // Empty
    { input: '   ', expected: false }, // Only whitespace
  ];

  console.log('Testing friend code validation...');
  testCases.forEach(({ input, expected }) => {
    const result = sanitizeFriendCode(input);
    const passed = result.isValid === expected;
    console.log(`${passed ? '✓' : '✗'} "${input}" -> "${result.code}" (${result.isValid ? 'valid' : 'invalid'})`);
    if (!passed) {
      console.log(`  Expected: ${expected}, Got: ${result.isValid}`);
    }
  });
};

