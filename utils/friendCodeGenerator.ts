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

