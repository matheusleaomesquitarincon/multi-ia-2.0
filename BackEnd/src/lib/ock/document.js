// Geração de ARQUIVO a partir do conteúdo que a IA monta. É a "mão" que faltava: a IA (API) devolve
// texto; aqui a OCK transforma esse texto num arquivo de verdade (PDF, CSV ou TXT) para baixar.
// PDF é renderizado com pdf-lib (JS puro, roda no servidor); a planilha, por nós mesmos (spreadsheet.ts). Só o
// servidor usa.

import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { parseRichText } from "./rich-text.js";
import { csvToXlsx } from "./spreadsheet.js";

/** @typedef {"pdf" | "csv" | "txt" | "xlsx" | "docx"} DocFormat */

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * @typedef {{
 * name: string;
 * mime: string;
 * bytes: Uint8Array;
 * }} GeneratedDoc
 */

/**
 * Decide o formato do arquivo a partir do pedido. O formato pedido explicitamente ganha (ex.: "pdf").
 * @param {string} message
 * @returns {DocFormat}
 */
export function pickFormat(message) {
  const t = message.toLowerCase();
  if (/\bpdf\b/.test(t)) return "pdf"; // se a pessoa escreveu "pdf", é PDF — mesmo falando de uma planilha.
  if (/\b(excel|xlsx|planilha)\b/.test(t)) return "xlsx";
  if (/\b(word|docx)\b/.test(t)) return "docx";
  if (/\b(csv|tabela)\b/.test(t)) return "csv";
  if (/\b(txt|bloco de notas|texto puro)\b/.test(t)) return "txt";
  return "pdf";
}

/**
 * Monta o arquivo final a partir do conteúdo (texto) produzido pela IA.
 * @param {string} title
 * @param {string} content
 * @param {DocFormat} format
 * @returns {Promise<GeneratedDoc>}
 */
export async function generateDocument(title, content, format) {
  const base = safeName(title) || "documento";
  if (format === "csv") {
    return { name: `${base}.csv`, mime: "text/csv", bytes: new TextEncoder().encode(content) };
  }
  if (format === "txt") {
    return { name: `${base}.txt`, mime: "text/plain", bytes: new TextEncoder().encode(content) };
  }
  if (format === "xlsx") {
    return { name: `${base}.xlsx`, mime: XLSX_MIME, bytes: await csvToXlsx(content) };
  }
  if (format === "docx") {
    return { name: `${base}.docx`, mime: DOCX_MIME, bytes: await renderDocx(title, content) };
  }
  return { name: `${base}.pdf`, mime: "application/pdf", bytes: await renderPdf(title, content) };
}

/** Converte o texto que a IA montou num documento Word (.docx). */
async function renderDocx(title, content) {
  const children = [new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 })];
  for (const line of content.split("\n")) {
    children.push(new Paragraph({ children: [new TextRun(line)] }));
  }
  const doc = new Document({ sections: [{ children }] });
  const buf = await Packer.toBuffer(doc);
  return new Uint8Array(buf);
}

/**
 * O resultado em texto de uma receita (ex.: a proposta comercial) num arquivo Word, com o título, as seções, as listas e
 * os destaques que a IA marcou (lib/ock/rich-text.js). O nome vem da receita, nunca do pedido (F49).
 * @param {string} name
 * @param {string} text
 * @returns {Promise<GeneratedDoc>}
 */
export async function textDocument(name, text) {
  const paragraphs = parseRichText(text).map(toParagraph);
  const doc = new Document({ sections: [{ children: paragraphs.length > 0 ? paragraphs : [new Paragraph("")] }] });
  const bytes = new Uint8Array(await Packer.toBuffer(doc));
  return { name: `${safeName(name) || "documento"}.docx`, mime: DOCX_MIME, bytes };
}

function toParagraph(block) {
  const children = block.spans.map((span) => new TextRun({ text: span.text, bold: span.bold }));
  if (block.kind === "title") return new Paragraph({ children, heading: HeadingLevel.HEADING_1 });
  if (block.kind === "heading") return new Paragraph({ children, heading: HeadingLevel.HEADING_2 });
  if (block.kind === "item") return new Paragraph({ children, bullet: { level: 0 } });
  return new Paragraph({ children });
}

const PAGE_W = 595.28; // A4 em pontos
const PAGE_H = 841.89;
const MARGIN = 56;

async function renderPdf(title, content) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const size = 11;
  const titleSize = 16;
  const lineH = size * 1.5;
  const maxW = PAGE_W - MARGIN * 2;

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  for (const tline of wrap(title, bold, titleSize, maxW)) {
    page.drawText(tline, { x: MARGIN, y: y - titleSize, size: titleSize, font: bold });
    y -= titleSize * 1.5;
  }
  y -= lineH * 0.5;

  for (const raw of content.replace(/\t/g, "  ").split("\n")) {
    const lines = raw.length ? wrap(raw, font, size, maxW) : [""];
    for (const line of lines) {
      if (y < MARGIN + lineH) {
        page = doc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN;
      }
      if (line) page.drawText(line, { x: MARGIN, y: y - size, size, font });
      y -= lineH;
    }
  }
  return doc.save();
}

/** Quebra uma linha em várias que cabem na largura da página. */
function wrap(text, font, size, maxW) {
  const clean = sanitize(text);
  if (!clean) return [""];
  const words = clean.split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const candidate = cur ? `${cur} ${w}` : w;
    if (cur && font.widthOfTextAtSize(candidate, size) > maxW) {
      lines.push(cur);
      cur = w;
    } else {
      cur = candidate;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

/** As fontes padrão do PDF só desenham caracteres WinAnsi (ASCII + Latin-1). Tira emoji e o resto. */
function sanitize(s) {
  return s.replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

function safeName(name) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
