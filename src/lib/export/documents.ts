import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';

export interface ExportApplicationDocumentInput {
  candidateName: string;
  jobTitle: string;
  company: string | null;
  coverLetter: string;
  presentationPage?: string;
  atsKeywords?: string[];
  includePresentation?: boolean;
}

/**
 * Normalizes characters outside WinAnsi Latin-1 range so pdf-lib StandardFonts
 * never throws encoding errors on French typographic punctuation.
 */
function toWinAnsiSafe(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A]/g, "'")
    .replace(/[\u201C\u201D\u201E\u00AB\u00BB]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u0153/g, 'oe')
    .replace(/\u0152/g, 'OE')
    .replace(/\u20AC/g, 'EUR')
    .replace(/[\u2022\u25AA\u25CF]/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '');
}

function wrapLine(
  text: string,
  maxWidth: number,
  measureWidth: (s: string) => number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measureWidth(candidate) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function generateApplicationPdfBuffer(
  input: ExportApplicationDocumentInput
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`Candidature — ${input.jobTitle}`);
  pdfDoc.setAuthor(input.candidateName || 'Fabien Lufbery');
  pdfDoc.setCreator('Job Hunter Agent for Fabien Lufbery');

  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const marginX = 52;
  const marginTop = 56;
  const marginBottom = 52;
  const contentWidth = pageWidth - marginX * 2;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let cursorY = pageHeight - marginTop;

  const ensureSpace = (neededHeight: number) => {
    if (cursorY - neededHeight < marginBottom) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      cursorY = pageHeight - marginTop;
    }
  };

  const drawTextBlock = (
    rawText: string,
    opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; lineGap?: number }
  ) => {
    const size = opts.size ?? 10.5;
    const font = opts.bold ? boldFont : regularFont;
    const color = opts.color ?? rgb(0.12, 0.14, 0.19);
    const lineHeight = size + (opts.lineGap ?? 4.5);

    const safe = toWinAnsiSafe(rawText);
    const paragraphs = safe.split('\n');

    for (const para of paragraphs) {
      if (!para.trim()) {
        cursorY -= lineHeight * 0.65;
        continue;
      }
      const wrapped = wrapLine(para, contentWidth, (s) => font.widthOfTextAtSize(s, size));
      for (const line of wrapped) {
        ensureSpace(lineHeight);
        page.drawText(line, {
          x: marginX,
          y: cursorY,
          size,
          font,
          color,
        });
        cursorY -= lineHeight;
      }
    }
  };

  // Header Banner
  drawTextBlock(input.candidateName || 'Fabien Lufbery', {
    size: 16,
    bold: true,
    color: rgb(0.08, 0.14, 0.3),
    lineGap: 6,
  });
  drawTextBlock(
    `Candidature : ${input.jobTitle}${input.company ? ` — ${input.company}` : ''}`,
    {
      size: 11.5,
      bold: true,
      color: rgb(0.24, 0.34, 0.56),
      lineGap: 6,
    }
  );
  cursorY -= 8;
  page.drawLine({
    start: { x: marginX, y: cursorY },
    end: { x: pageWidth - marginX, y: cursorY },
    thickness: 0.8,
    color: rgb(0.75, 0.8, 0.88),
  });
  cursorY -= 18;

  // Cover letter
  drawTextBlock('LETTRE DE MOTIVATION', {
    size: 11,
    bold: true,
    color: rgb(0.1, 0.16, 0.32),
    lineGap: 6,
  });
  cursorY -= 4;
  drawTextBlock(input.coverLetter, { size: 10.5, lineGap: 4.5 });

  // Presentation page (optional second section)
  if (input.includePresentation !== false && input.presentationPage?.trim()) {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    cursorY = pageHeight - marginTop;
    drawTextBlock('PAGE DE PRESENTATION DE CANDIDATURE', {
      size: 12,
      bold: true,
      color: rgb(0.08, 0.14, 0.3),
      lineGap: 6,
    });
    cursorY -= 6;
    const cleanPresentation = input.presentationPage.replace(/^#+\s*/gm, '').replace(/\*\*/g, '');
    drawTextBlock(cleanPresentation, { size: 10.5, lineGap: 4.5 });
  }

  if (input.atsKeywords && input.atsKeywords.length > 0) {
    cursorY -= 12;
    ensureSpace(40);
    drawTextBlock(`Mots-cles ATS alignes : ${input.atsKeywords.join(', ')}`, {
      size: 9,
      color: rgb(0.35, 0.4, 0.5),
      lineGap: 4,
    });
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

export async function generateApplicationDocxBuffer(
  input: ExportApplicationDocumentInput
): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: input.candidateName || 'Fabien Lufbery', bold: true })],
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [
        new TextRun({
          text: `Candidature : ${input.jobTitle}${input.company ? ` — ${input.company}` : ''}`,
        }),
      ],
    }),
    new Paragraph({ text: '' }),
    new Paragraph({
      heading: HeadingLevel.HEADING_3,
      children: [new TextRun({ text: 'Lettre de motivation', bold: true })],
    }),
    ...input.coverLetter.split('\n').map(
      (line) =>
        new Paragraph({
          children: [new TextRun({ text: line })],
          spacing: { after: 120 },
        })
    ),
  ];

  if (input.includePresentation !== false && input.presentationPage?.trim()) {
    children.push(
      new Paragraph({ text: '', pageBreakBefore: true }),
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: 'Page de présentation de candidature', bold: true })],
      }),
      ...input.presentationPage.split('\n').map(
        (line) =>
          new Paragraph({
            children: [new TextRun({ text: line.replace(/^#+\s*/, '').replace(/\*\*/g, '') })],
            spacing: { after: 100 },
          })
      )
    );
  }

  if (input.atsKeywords && input.atsKeywords.length > 0) {
    children.push(
      new Paragraph({ text: '' }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Mots-clés ATS : ', bold: true }),
          new TextRun({ text: input.atsKeywords.join(', ') }),
        ],
      })
    );
  }

  const doc = new Document({
    creator: 'Job Hunter Agent for Fabien Lufbery',
    title: `Candidature — ${input.jobTitle}`,
    sections: [{ properties: {}, children }],
  });

  return Packer.toBuffer(doc);
}
