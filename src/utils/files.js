import { ACCEPTED_AUDIO_EXTENSIONS, MAX_UPLOAD_MB } from '../data/constants';
import { fileExtension } from './format';

export function validateAudioFile(file) {
  if (!file) return 'Select an audio file.';
  const extension = fileExtension(file.name);
  if (!ACCEPTED_AUDIO_EXTENSIONS.includes(extension)) {
    return `Unsupported format ${extension || '(unknown)'}. The backend accepts ${ACCEPTED_AUDIO_EXTENSIONS.join(', ')}.`;
  }
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    return `File is larger than the ${MAX_UPLOAD_MB} MB upload limit.`;
  }
  if (file.size === 0) {
    return 'The selected file is empty.';
  }
  return '';
}

export function formatFileType(file) {
  const extension = fileExtension(file.name);
  return extension ? extension.slice(1).toUpperCase() : 'Audio';
}
