/**
 * Generates a professional initials-based avatar URL using UI Avatars API
 * @param name - The full name to generate initials from
 * @param size - The size of the avatar in pixels (default: 128)
 * @returns The URL for the avatar image
 */
export function getInitialsAvatarUrl(name: string, size: number = 128): string {
  const encodedName = encodeURIComponent(name.trim() || 'CL');
  // Using the app's primary green color (22c55e) for background
  return `https://ui-avatars.com/api/?name=${encodedName}&background=22c55e&color=fff&bold=true&size=${size}&format=svg`;
}

/**
 * Gets the appropriate avatar URL - either the uploaded photo or a generated initials avatar
 * @param avatarUrl - The stored avatar URL (could be uploaded photo or null)
 * @param fullName - The client's full name for fallback initials
 * @param size - The size of the avatar in pixels
 * @returns The URL to use for the avatar
 */
export function getAvatarUrl(avatarUrl: string | null | undefined, fullName: string, size: number = 128): string {
  // If there's a real photo uploaded (not a DiceBear cartoon), use it
  if (avatarUrl && !avatarUrl.includes('dicebear.com')) {
    return avatarUrl;
  }
  // Otherwise, generate an initials avatar
  return getInitialsAvatarUrl(fullName, size);
}

/**
 * Extracts initials from a full name
 * @param name - The full name
 * @returns Two-letter initials
 */
export function getInitials(name: string): string {
  if (!name) return 'CL';
  const names = name.trim().split(' ').filter(Boolean);
  if (names.length >= 2) {
    return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
  }
  return names[0]?.substring(0, 2).toUpperCase() || 'CL';
}
