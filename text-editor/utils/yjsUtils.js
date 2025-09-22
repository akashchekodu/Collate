import * as Y from 'yjs';

/**
 * ✅ SAFE: Only get existing Y.Text instance, don't create new ones
 * @param {Y.Doc} ydoc - The Y.js document
 * @param {string} fieldName - The field name to access
 * @returns {Y.Text | null} - The Y.Text instance or null if not found
 */
export function getSafeYText(ydoc, fieldName) {
  if (!ydoc || !fieldName) return null;

  try {
    // ✅ SAFE: Only access existing shared types, don't create new ones
    if (ydoc.share && ydoc.share.has(fieldName)) {
      const ytext = ydoc.share.get(fieldName);
      console.log('📋 Y.Text field accessed safely:', {
        fieldName,
        exists: true,
        contentLength: ytext.length
      });
      return ytext;
    }
    
    console.log('📋 Y.Text field does not exist yet:', fieldName);
    return null; // Don't create new types to avoid redefinition errors
  } catch (error) {
    console.warn('Error accessing Y.Text:', error);
    return null;
  }
}

/**
 * Get content from Y.Text safely
 */
export function getSafeYTextContent(ydoc, fieldName) {
  const ytext = getSafeYText(ydoc, fieldName);
  return ytext ? ytext.toString() : '';
}

/**
 * Check if a Y.Text field exists in the document
 */
export function hasYTextField(ydoc, fieldName) {
  if (!ydoc || !fieldName) return false;
  return ydoc.share && ydoc.share.has(fieldName);
}
