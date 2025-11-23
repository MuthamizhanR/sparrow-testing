#!/usr/bin/env python3
"""
extract_mcqs_from_pediatrics.py
Input: /mnt/data/Pediatrics.pdf (uploaded file in this session)
Output:
  - data/pediatrics_extracted.json
  - data/pediatrics_extraction_audit.csv
"""

import re
import os
import json
import csv
import fitz  # PyMuPDF
from collections import defaultdict

# Optional: RapidOCR (GPU if installed). If missing, OCR steps will be skipped.
try:
    from rapidocr_onnxruntime import RapidOCR
    OCR_AVAILABLE = True
except Exception:
    OCR_AVAILABLE = False

PDF_PATH = "/mnt/data/Pediatrics.pdf"   # <- file from your session
OUT_DIR = "data"
OUT_JSON = os.path.join(OUT_DIR, "pediatrics_extracted.json")
OUT_AUDIT = os.path.join(OUT_DIR, "pediatrics_extraction_audit.csv")

os.makedirs(OUT_DIR, exist_ok=True)

# Regex patterns (tunable)
RE_Q = re.compile(r'Question\s+(\d+)\s*[:\.\-]?', re.IGNORECASE)
RE_OPT = re.compile(r'^[\(\[]?\s*([a-dA-D])\s*[\)\.\]]\s*(.+)', re.IGNORECASE)
RE_SOL = re.compile(r'Solution\s+to\s+Question\s+(\d+)\s*[:\.\-]?', re.IGNORECASE)
RE_ANS_TABLE_LINE = re.compile(r'^\s*(\d{1,4})\s+([a-dA-D])\s*$', re.IGNORECASE)
RE_ANS_INLINE = re.compile(r'^(?:Ans(?:wer)?[:\s]*)?([a-dA-D])\b', re.IGNORECASE)
RE_ANSWER_KEY_HEADING = re.compile(r'Answer\s+Key', re.IGNORECASE)

# Cleaning helper - attempt to remove common mojibake and replace weird placeholders
def clean_text(s: str) -> str:
    if not s:
        return ""
    s = s.replace('\u00a0', ' ')
    s = s.replace('\ufffd', '')  # replacement character
    # remove odd control characters
    s = "".join(ch for ch in s if (ord(ch) >= 32 or ch in '\n\t\r'))
    s = re.sub(r'\s+', ' ', s).strip()
    return s

# Heuristic: decide whether extracted text is "garbled" and needs OCR
def looks_garbled(s: str) -> bool:
    if not s or len(s) < 30:
        # short pages are suspicious
        return True
    # if many replacement glyphs or many non-ascii sequences -> garbled
    weird = s.count('�') + s.count('�') + len(re.findall(r'[^\x00-\x7F\u0900-\u0fff]', s))
    if weird / max(1, len(s)) > 0.02:
        return True
    # if letters are rare vs punctuation -> garbled
    letters = len(re.findall(r'[A-Za-z]', s))
    punctuation = len(re.findall(r'[\(\)\[\]\.,;:—-]', s))
    if letters < punctuation:
        return True
    return False

# Initialize OCR engine if available - try GPU flags
def init_ocr():
    if not OCR_AVAILABLE:
        return None
    try:
        engine = RapidOCR(det_use_cuda=True, cls_use_cuda=True, rec_use_cuda=True)
        print("RapidOCR (GPU) initialized.")
        return engine
    except Exception:
        try:
            engine = RapidOCR()
            print("RapidOCR (CPU) initialized as fallback.")
            return engine
        except Exception:
            print("RapidOCR import succeeded but initialization failed.")
            return None

ocr_engine = init_ocr()

# Extract text for each page using PyMuPDF; fallback to image OCR for garbled pages
doc = fitz.open(PDF_PATH)
pages_text = {}
pages_need_ocr = []
for pno in range(len(doc)):
    page = doc.load_page(pno)
    raw = page.get_text("text")
    raw_clean = clean_text(raw)
    if not raw_clean or looks_garbled(raw_clean):
        # mark for OCR
        pages_need_ocr.append(pno)
        pages_text[pno] = ""  # fill later via OCR
    else:
        pages_text[pno] = raw_clean

# OCR the marked pages if engine present
if pages_need_ocr and ocr_engine:
    print(f"OCR-ing {len(pages_need_ocr)} pages with RapidOCR...")
    for pno in pages_need_ocr:
        page = doc.load_page(pno)
        pix = page.get_pixmap(dpi=200)
        img_bytes = pix.tobytes("png")
        try:
            result, _ = ocr_engine(img_bytes)
            # RapidOCR returns list of (word_confidence, text)
            text = "\n".join([r[1] for r in result]) if result else ""
            pages_text[pno] = clean_text(text)
        except Exception as e:
            print(f"  OCR failed for page {pno+1}: {e}")
            pages_text[pno] = ""
else:
    if pages_need_ocr:
        print("Pages marked as garbled but RapidOCR not available. Consider installing rapidocr_onnxruntime.")

# Combine pages into a large string with page markers
combined_pages = []
for pno in range(len(doc)):
    combined_pages.append(f"[[PAGE {pno+1}]]\n{pages_text.get(pno, '')}\n")

full_text = "\n".join(combined_pages)

# --- PASS 1: extract Answer Key tables (many PDFs have them) ---
answer_map = {}  # qid -> letter
for m in RE_ANSWER_KEY_HEADING.finditer(full_text):
    # find next ~200 chars to scan lines for "1 a" style entries
    start = m.end()
    snippet = full_text[start:start+2000]
    for line in snippet.splitlines():
        line = line.strip()
        if not line:
            continue
        lm = RE_ANS_TABLE_LINE.match(line)
        if lm:
            qid = int(lm.group(1))
            ans = lm.group(2).lower()
            answer_map[qid] = ans

# Also search entire text lines for standalone "1 a" table lines (global scan)
for line in full_text.splitlines():
    lm = RE_ANS_TABLE_LINE.match(line.strip())
    if lm:
        qid = int(lm.group(1))
        ans = lm.group(2).lower()
        answer_map[qid] = ans

# --- PASS 2: parse questions, options, and explanations ---
questions = {}  # id -> dict
current_q = None
current_q_page = None

lines_with_page = []
# split by page markers to track page_found
page_blocks = re.split(r'\[\[PAGE\s+(\d+)\]\]\n', full_text)
# page_blocks format: ['', '1', '...text...', '2', '...text...']
it = iter(page_blocks)
_ = next(it, None)  # initial empty
for page_num, block in zip(it, it):
    pnum = int(page_num)
    lines = block.splitlines()
    for line in lines:
        line_s = line.strip()
        if not line_s:
            continue

        # check question start
        qmatch = RE_Q.search(line_s)
        if qmatch:
            qid = int(qmatch.group(1))
            current_q = qid
            current_q_page = pnum
            questions.setdefault(qid, {
                "id": qid,
                "text": "",
                "options": {},
                "images": [],
                "correct": None,
                "explanation": "",
                "page_found": pnum
            })
            # capture remainder of line after pattern
            rest = RE_Q.sub("", line_s).strip()
            if rest:
                questions[qid]["text"] += " " + clean_text(rest)
            continue

        # option lines
        optm = RE_OPT.match(line_s)
        if optm and current_q:
            key = optm.group(1).lower()
            val = clean_text(optm.group(2))
            questions[current_q]["options"][key] = val
            continue

        # Solution to Question lines -- start capturing explanation
        solm = RE_SOL.search(line_s)
        if solm:
            sol_qid = int(solm.group(1))
            # ensure entry
            questions.setdefault(sol_qid, {
                "id": sol_qid,
                "text": "",
                "options": {},
                "images": [],
                "correct": None,
                "explanation": "",
                "page_found": None
            })
            # start capturing explanation from following lines.
            # We'll mark by setting a capturing flag in a local structure below.
            # For simplicity, append this line's remainder:
            rest = RE_SOL.sub("", line_s).strip()
            if rest:
                questions[sol_qid]["explanation"] += " " + clean_text(rest)
            # set a marker that subsequent lines belong to explanation until next "Solution" or blank header
            # We'll collect explanations via a second pass below.
            continue

        # inline answer lines like 'Ans: b' after question block
        ansm = RE_ANS_INLINE.match(line_s)
        if ansm and current_q:
            ans = ansm.group(1).lower()
            questions[current_q]["correct"] = ans
            continue

        # If currently inside a question block, append to its text if it's not an option
        if current_q and not RE_OPT.match(line_s):
            # avoid grabbing "Answer Key" lines here
            if RE_ANSWER_KEY_HEADING.search(line_s):
                continue
            questions[current_q]["text"] += " " + clean_text(line_s)

# --- PASS 3: Extract explanations blocks separately (search "Solution to Question X" occurrences and capture following text until next "Solution" or "Answer Key") ---
sol_pattern = re.compile(r'(Solution\s+to\s+Question\s+(\d+)\s*[:\.\-]?)', re.IGNORECASE)
all_text_lines = full_text.splitlines()
i = 0
while i < len(all_text_lines):
    line = all_text_lines[i].strip()
    sm = sol_pattern.search(line)
    if sm:
        qid = int(sm.group(2))
        # collect subsequent lines as explanation until next blank line that looks like new section or next Solution
        expl_parts = []
        # append remainder of same line after match
        remainder = sol_pattern.sub("", line).strip()
        if remainder:
            expl_parts.append(remainder)
        j = i + 1
        while j < len(all_text_lines):
            nxt = all_text_lines[j].strip()
            if not nxt:
                # allow one blank; use heuristics: if next non-empty looks like "Solution to" or "Question" or "Answer Key" break
                # check lookahead
                k = j+1
                found_nonempty = False
                while k < len(all_text_lines) and not found_nonempty:
                    if all_text_lines[k].strip():
                        found_nonempty = True
                        look = all_text_lines[k].strip()
                        if RE_Q.search(look) or RE_SOL.search(look) or RE_ANSWER_KEY_HEADING.search(look):
                            break
                    k += 1
                # break if next non-empty is a header
                if found_nonempty and (RE_Q.search(all_text_lines[k].strip()) or RE_SOL.search(all_text_lines[k].strip()) or RE_ANSWER_KEY_HEADING.search(all_text_lines[k].strip())):
                    break
                # else include the blank and continue
                expl_parts.append("")
                j += 1
                continue

            # stop if this line looks like the start of another solution or an answer key table
            if sol_pattern.search(nxt) or RE_ANSWER_KEY_HEADING.search(nxt):
                break
            # stop if a plain "Question X" appears and it's not just a continuation (likely next block)
            if RE_Q.search(nxt):
                break

            # if line looks like "1 a" (answer key), break
            if RE_ANS_TABLE_LINE.match(nxt):
                break

            expl_parts.append(clean_text(nxt))
            j += 1

        expl_text = " ".join(expl_parts).strip()
        if expl_text:
            questions.setdefault(qid, {
                "id": qid,
                "text": "",
                "options": {},
                "images": [],
                "correct": None,
                "explanation": "",
                "page_found": None
            })
            # append (preserve if earlier small text exists)
            if questions[qid].get("explanation"):
                questions[qid]["explanation"] += " " + expl_text
            else:
                questions[qid]["explanation"] = expl_text

        i = j
        continue
    i += 1

# --- PASS 4: merge answer_map into questions where missing ---
for qid, ans in answer_map.items():
    if qid in questions:
        if not questions[qid].get("correct"):
            questions[qid]["correct"] = ans
    else:
        # create minimal entry for answer-only lines
        questions[qid] = {
            "id": qid,
            "text": "",
            "options": {},
            "images": [],
            "correct": ans,
            "explanation": "",
            "page_found": None
        }

# Final cleaning: normalize option keys, ensure a,b,c,d present (may be missing)
final_list = []
for qid in sorted(questions.keys()):
    q = questions[qid]
    # ensure options keys lower-case
    cleaned_opts = {}
    for k, v in q.get("options", {}).items():
        if isinstance(k, str) and k.strip():
            cleaned_opts[k.strip().lower()] = v
    q["options"] = cleaned_opts
    # normalize correct
    if q.get("correct"):
        c = q["correct"]
        if isinstance(c, str):
            q["correct"] = c.strip().lower()
    final_list.append(q)

# Save JSON
with open(OUT_JSON, "w", encoding="utf-8") as fj:
    json.dump(final_list, fj, indent=2, ensure_ascii=False)

# Save audit CSV: qid, page_found, has_options_count, has_correct, has_explanation
with open(OUT_AUDIT, "w", newline='', encoding="utf-8") as fc:
    writer = csv.writer(fc)
    writer.writerow(["id", "page_found", "options_count", "has_correct", "has_explanation"])
    for q in final_list:
        writer.writerow([
            q.get("id"),
            q.get("page_found"),
            len(q.get("options", {})),
            bool(q.get("correct")),
            bool(q.get("explanation"))
        ])

print(f"Done. Extracted {len(final_list)} question entries.")
print(f"Output JSON: {OUT_JSON}")
print(f"Audit CSV: {OUT_AUDIT}")
if pages_need_ocr:
    print(f"Pages that required OCR: {', '.join(str(p+1) for p in pages_need_ocr)}")
