import { describe, expect, it } from 'vitest';
import {
  generateApplicationDocxBuffer,
  generateApplicationPdfBuffer,
} from '@/lib/export/documents';
import { parseCvBuffer } from '@/lib/cv/parser';
import { computeCvContentHash, extractStructuredCvDeterministic } from '@/lib/cv/extractor';

const SAMPLE_CV_TEXT = `Claire Dupont
Ingénieure Logiciel Full-Stack TypeScript & Data
Paris, France
claire.dupont@example.org
+33 6 12 34 56 78
https://github.com/claire-dupont

Profil
Développeuse Full-Stack spécialisée en TypeScript, Next.js, PostgreSQL et automatisation IA.

Expériences
Développeuse Full-Stack — Atelier Web SAS (2023-2026)
- Conception d'API REST TypeScript et Node.js avec PostgreSQL
- Déploiement CI/CD avec Docker et GitHub Actions

Formation
Master Informatique — Université Paris Cité (2021-2023)

Compétences
TypeScript, React, Next.js, PostgreSQL, Docker, Python, OAuth2, Autonomie, Rigueur

Langues
Français : Natif
Anglais : Courant (C1)

Certifications
AWS Certified Developer`;

describe('CV Import (PDF & DOCX) and Document Export Round-Trip', () => {
  it('generates a valid PDF and re-parses it cleanly via parseCvBuffer (unpdf)', async () => {
    const pdfBuf = await generateApplicationPdfBuffer({
      candidateName: 'Claire Dupont',
      jobTitle: 'Senior TypeScript Engineer',
      company: 'TechCorp',
      coverLetter: SAMPLE_CV_TEXT,
      presentationPage: 'Synthèse de compétences Next.js, PostgreSQL et OAuth2.',
      atsKeywords: ['TypeScript', 'Next.js', 'PostgreSQL'],
    });

    expect(pdfBuf.subarray(0, 4).toString('ascii')).toBe('%PDF');
    expect(pdfBuf.length).toBeGreaterThan(1000);

    const parsed = await parseCvBuffer(pdfBuf, 'CV_Test.pdf', 'application/pdf');
    expect(parsed.fileType).toBe('pdf');
    expect(parsed.rawText).toContain('Claire Dupont');
    expect(parsed.rawText).toContain('TypeScript');
    expect(parsed.rawText).toContain('PostgreSQL');
  });

  it('generates a valid DOCX and re-parses it cleanly via parseCvBuffer (mammoth)', async () => {
    const docxBuf = await generateApplicationDocxBuffer({
      candidateName: 'Claire Dupont',
      jobTitle: 'Senior TypeScript Engineer',
      company: 'TechCorp',
      coverLetter: SAMPLE_CV_TEXT,
      presentationPage: 'Présentation synthétique.',
      atsKeywords: ['TypeScript', 'PostgreSQL'],
    });

    // DOCX is a ZIP archive starting with PK
    expect(docxBuf.subarray(0, 2).toString('ascii')).toBe('PK');
    expect(docxBuf.length).toBeGreaterThan(2000);

    const parsed = await parseCvBuffer(
      docxBuf,
      'CV_Test.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    expect(parsed.fileType).toBe('docx');
    expect(parsed.rawText).toContain('Claire Dupont');
    expect(parsed.rawText).toContain('Atelier Web SAS');
    expect(parsed.rawText).toContain('Master Informatique');
  });

  it('extracts structured CV fields deterministically without fabricating absent skills', () => {
    const structured = extractStructuredCvDeterministic(SAMPLE_CV_TEXT);
    expect(structured.fullName).toBe('Claire Dupont');
    expect(structured.email).toBe('claire.dupont@example.org');
    expect(structured.location).toMatch(/Paris/i);
    expect(structured.technicalSkills).toEqual(
      expect.arrayContaining(['TypeScript', 'Next.js', 'PostgreSQL', 'Docker', 'OAuth2'])
    );
    // Must NEVER invent skills not present in CV text
    expect(structured.technicalSkills).not.toContain('Kubernetes');
    expect(structured.technicalSkills).not.toContain('SAP');
    expect(structured.softSkills).toEqual(expect.arrayContaining(['Autonomie', 'Rigueur']));
    expect(structured.languages.map((l) => l.name)).toEqual(
      expect.arrayContaining(['Français', 'Anglais'])
    );
    expect(structured.education.length).toBeGreaterThan(0);
    expect(structured.experiences.length).toBeGreaterThan(0);
    expect(structured.certifications.length).toBeGreaterThan(0);

    const hashA = computeCvContentHash(structured);
    const hashB = computeCvContentHash({ ...structured, location: 'Lyon' });
    expect(hashA).not.toBe(hashB);
  });

  it('rejects unsupported file formats and empty buffers', async () => {
    await expect(parseCvBuffer(Buffer.alloc(0), 'empty.pdf')).rejects.toThrow(/vide/i);
    await expect(
      parseCvBuffer(Buffer.from('plain text'), 'resume.txt', 'text/plain')
    ).rejects.toThrow(/non pris en charge/i);
  });
});
