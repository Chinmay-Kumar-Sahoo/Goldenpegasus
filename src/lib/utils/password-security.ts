/**
 * Checks if a password has been compromised in a data breach using the HaveIBeenPwned API.
 * Uses the k-Anonymity model to ensure the actual password is never sent to the server.
 * 
 * @param password The plain text password to check
 * @returns Promise<boolean> True if the password has been leaked, false otherwise
 */
export async function isPasswordPwned(password: string): Promise<boolean> {
  if (!password) return false;

  try {
    // 1. Hash the password using SHA-1
    const msgUint8 = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-1', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

    // 2. Take the first 5 characters (prefix) and the rest (suffix)
    const prefix = hashHex.substring(0, 5);
    const suffix = hashHex.substring(5);

    // 3. Query the HIBP Range API with the prefix
    // This is secure as the prefix is not unique enough to identify the password
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      method: 'GET',
      headers: {
        'Accept': 'text/plain',
      },
      // Cache the response for performance
      next: { revalidate: 86400 } // 24 hours
    } as any);

    if (!response.ok) {
      console.warn('HIBP API check failed, skipping leaked password validation.');
      return false; // Fail open if API is down
    }

    const text = await response.text();
    const lines = text.split('\n');

    // 4. Check if the suffix exists in the results
    return lines.some(line => line.split(':')[0].trim() === suffix);
  } catch (error) {
    console.error('Error checking pwned password:', error);
    return false; // Fail open to not block users if something goes wrong
  }
}
