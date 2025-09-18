// utils/yjsUtils.js
import * as Y from 'yjs';

/**
 * Safely get a Y.Text instance from a Y.Doc without triggering redefinition errors
 * @param {Y.Doc} ydoc - The Y.js document
 * @param {string} fieldName - The field name to access
 * @returns {Y.Text | null} - The Y.Text instance or null if not found
 */
export function getSafeYText(ydoc, fieldName) {
  if (!ydoc || !fieldName) return null;

  try {
    // Only access existing shared types, don't create new ones
    if (ydoc.share && ydoc.share.has(fieldName)) {
      return ydoc.share.get(fieldName);
    }
    return null; // Don't create new types to avoid redefinition errors
  } catch (error) {
    console.warn('Error accessing Y.Text:', error);
    return null;
  }
}

/**
 * Get content from Y.Text safely
 * @param {Y.Doc} ydoc - The Y.js document
 * @param {string} fieldName - The field name
 * @returns {string} - The text content or empty string
 */
export function getSafeYTextContent(ydoc, fieldName) {
  const ytext = getSafeYText(ydoc, fieldName);
  return ytext ? ytext.toString() : '';
}

/**
 * Check if a Y.Text field exists in the document
 * @param {Y.Doc} ydoc - The Y.js document
 * @param {string} fieldName - The field name to check
 * @returns {boolean} - True if field exists
 */
export function hasYTextField(ydoc, fieldName) {
  if (!ydoc || !fieldName) return false;
  return ydoc.share && ydoc.share.has(fieldName);
}
