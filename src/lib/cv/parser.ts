import { extractText } from 'unpdf';
import mammoth from 'mammoth';

export const MAX_CV_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface ParsedCvDocument {
  fileType: 'pdf' | 'docx';
  rawText: string;
  pageCount?: number;
}

export function detectCvFileType(fileName: string, mimeType?: string): 'pdf' | 'docx' | null {
  const lowerName = fileName.toLowerCase();
  const lowerMime = (mimeType || '').toLowerCase();

  if (lowerName.endsWith('.pdf') || lowerMime === 'application/pdf') {
    return 'pdf';
  }
  if (
    lowerName.endsWith('.docx') ||
    lowerMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'docx';
  }
  return null;
}

export async function parseCvBuffer(
  buffer: Buffer,
  fileName: string,
  mimeType?: string
): Promise<ParsedCvDocument> {
  if (!buffer || buffer.length === 0) {
    throw new Error('Le fichier CV est vide.');
  }
  if (buffer.length > MAX_CV_FILE_BYTES) {
    throw new Error('Le fichier CV dépasse la taille maximale autorisée (10 Mo).');
  }

  const fileType = detectCvFileType(fileName, mimeType);
  if (!fileType) {
    throw new Error('Format de fichier non pris en charge. Importez un fichier PDF (.pdf) ou Word (.docx).');
  }

  if (fileType === 'pdf') {
    const result = await extractText(new Uint8Array(buffer), { mergePages: true });
    const rawText = (Array.isArray(result.text) ? result.text.join('\n') : String(result.text || ''))
      .replace(/\u0000/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!rawText) {
      throw new Error(
        'Aucun texte exploitable détecté dans ce PDF (PDF scanné ou protégé). Importez un PDF texte ou un DOCX.'
      );
    }

    return {
      fileType: 'pdf',
      rawText,
      pageCount: result.totalPages,
    };
  }

  const docxResult = await mammoth.extractRawText({ buffer });
  const rawText = (docxResult.value || '')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!rawText) {
    throw new Error('Aucun texte exploitable détecté dans ce fichier DOCX.');
  }

  return {
    fileType: 'docx',
    rawText,
  };
}
