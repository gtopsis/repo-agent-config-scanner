/** Whether this browser supports the File System Access API this app depends on
 * (Chromium-based browsers only, as of writing). */
export function isFileSystemAccessSupported(): boolean {
  return typeof window.showDirectoryPicker === 'function';
}
