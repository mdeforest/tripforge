/**
 * Server-side text extraction from various itinerary input formats.
 * All functions run only on the server (Node.js runtime).
 */

/** Error thrown when text cannot be extracted from the provided input */
export class ExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractionError";
  }
}

/**
 * Extracts plain text from a PDF file buffer.
 * Throws ExtractionError if the PDF has no extractable text (e.g. scanned image).
 */
async function extractFromPdf(file: File): Promise<string> {
  // pdf-parse v2 uses a class-based API: new PDFParse({ data: buffer }).getText()
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PDFParse } = require("pdf-parse") as {
    PDFParse: new (opts: { data: Buffer }) => { getText(): Promise<{ text: string }> };
  };
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const data = await new PDFParse({ data: buffer }).getText();

  if (!data.text?.trim()) {
    throw new ExtractionError(
      "We couldn't read this PDF — it may be a scanned image. Try copying and pasting the text instead."
    );
  }
  return data.text;
}

/**
 * Extracts plain text from a DOCX file buffer using mammoth.
 */
async function extractFromDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });

  if (!result.value?.trim()) {
    throw new ExtractionError(
      "We couldn't extract text from this Word document. Try copying and pasting the text instead."
    );
  }
  return result.value;
}

/**
 * Fetches plain text from a public Google Docs URL.
 * Converts edit/view URLs to the export endpoint.
 *
 * Supported URL formats:
 *   https://docs.google.com/document/d/{id}/edit
 *   https://docs.google.com/document/d/{id}/view
 *   https://docs.google.com/document/d/{id}/
 */
async function extractFromGoogleDocs(url: string): Promise<string> {
  // Extract doc ID and build the export URL
  const match = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) {
    throw new ExtractionError(
      "That doesn't look like a valid Google Docs URL. Paste the sharing link directly from your browser."
    );
  }

  const docId = match[1];
  const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;

  const res = await fetch(exportUrl);
  if (!res.ok) {
    if (res.status === 403) {
      throw new ExtractionError(
        "This Google Doc is not publicly accessible. Open the doc, click Share, and set access to 'Anyone with the link'."
      );
    }
    throw new ExtractionError(
      `Couldn't fetch the Google Doc (status ${res.status}). Check the URL and try again.`
    );
  }

  const text = await res.text();
  if (!text.trim()) {
    throw new ExtractionError("The Google Doc appears to be empty.");
  }
  return text;
}

interface ExtractInput {
  text?: string | null;
  file?: File | null;
  googleDocsUrl?: string | null;
}

/**
 * Dispatches to the correct extraction method based on the provided input.
 * Exactly one of `text`, `file`, or `googleDocsUrl` must be non-empty.
 *
 * @throws ExtractionError for unreadable files or inaccessible URLs
 * @throws Error if no input is provided
 */
export async function extractRawText(input: ExtractInput): Promise<string> {
  const { text, file, googleDocsUrl } = input;

  if (text?.trim()) {
    return text.trim();
  }

  if (googleDocsUrl?.trim()) {
    return extractFromGoogleDocs(googleDocsUrl.trim());
  }

  if (file) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".pdf")) return extractFromPdf(file);
    if (name.endsWith(".docx")) return extractFromDocx(file);
    // Plain text files (.txt, .md, etc.)
    const txt = await file.text();
    if (!txt.trim()) {
      throw new ExtractionError("The uploaded file appears to be empty.");
    }
    return txt.trim();
  }

  throw new Error("NO_INPUT");
}
