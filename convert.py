import os
import re
import json
import fitz  # PyMuPDF
from collections import defaultdict

# ==========================================
# CONFIGURATION
# ==========================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FOLDER = os.path.join(BASE_DIR, "Put_PDFs_Here")
OUTPUT_FOLDER = os.path.join(BASE_DIR, "MedTrix_Engine_Data")
MANUAL_INDEX_FILE = os.path.join(BASE_DIR, "chapters.txt")

# Regex patterns
Q_PATTERN = re.compile(r"^Question\s+(\d+)\s*[:\.]", re.IGNORECASE)
OPT_PATTERN = re.compile(r"^([a-d])\)\s+(.*)", re.IGNORECASE)
SOL_PATTERN = re.compile(r"^Solution to Question\s+(\d+)\s*[:\.]", re.IGNORECASE)
KEY_PATTERN = re.compile(r"^(\d+)\s+([a-d])$", re.IGNORECASE)

def clean_text(text):
    if not text: return ""
    text = text.replace("â", "'").replace("€", "").replace("\u00a0", " ")
    text = re.sub(r'\s+', ' ', text).strip()
    return text

# ==========================================
# STEP 1: LOAD MANUAL CHAPTERS
# ==========================================
def load_manual_chapters():
    """Reads chapters.txt and builds a dictionary."""
    manual_data = {}
    if not os.path.exists(MANUAL_INDEX_FILE):
        return manual_data

    current_subject = None
    
    with open(MANUAL_INDEX_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line: continue
            
            # Check for [Subject Name]
            if line.startswith("[") and line.endswith("]"):
                current_subject = line[1:-1].strip()  # Remove brackets
                manual_data[current_subject] = []
                continue

            # Parse Chapter Line: "1. Title Name 50"
            # Matches anything ending in a number
            match = re.search(r"^(.*?)\s+(\d+)$", line)
            if match and current_subject:
                title_raw = match.group(1).strip()
                page_num = int(match.group(2))
                
                # Clean title (remove leading "1." or "1")
                title = re.sub(r"^\d+[\.\s]*", "", title_raw)
                
                manual_data[current_subject].append({
                    "title": title,
                    "start_page": page_num
                })
    
    return manual_data

# Global manual chapters cache
MANUAL_CHAPTERS = load_manual_chapters()

# ==========================================
# STEP 2: GET CHAPTER STRUCTURE
# ==========================================
def get_chapters(doc, doc_name):
    """
    Priority 1: Manual chapters.txt
    Priority 2: Auto-detect from PDF
    """
    chapters = []
    
    # 1. CHECK MANUAL FILE
    if doc_name in MANUAL_CHAPTERS:
        print("   ✅ Using Manual Index from chapters.txt")
        chapters = MANUAL_CHAPTERS[doc_name]
    
    # 2. AUTO-DETECT (Backup)
    else:
        print("   ...Scanning PDF for Table of Contents...")
        # Regex for TOC rows inside PDF
        toc_patterns = [
            re.compile(r"^\s*(\d+)\.?\s+(.+?)\s+(\d+)\s*$"),
            re.compile(r"^\s*(.+?)\s+\.{2,}\s*(\d+)\s*$")
        ]
        
        start_scan_page = -1
        # Scan first 10 pages
        for i in range(min(10, len(doc))):
            text = doc[i].get_text("text").lower()
            if any(x in text for x in ["contents", "index", "syllabus", "topic"]):
                start_scan_page = i
                break
        
        if start_scan_page != -1:
            for i in range(start_scan_page, min(start_scan_page + 3, len(doc))):
                page_lines = doc[i].get_text("text").split('\n')
                for line in page_lines:
                    line = clean_text(line)
                    if not line: continue
                    for pat in toc_patterns:
                        match = pat.match(line)
                        if match:
                            if len(match.groups()) == 3:
                                title = match.group(2).strip()
                                page_num = int(match.group(3))
                            else:
                                title = match.group(1).strip()
                                page_num = int(match.group(2))
                            if len(title) > 2 and page_num > 0:
                                chapters.append({"title": title, "start_page": page_num})
                            break
        
        # Fallback to PDF Meta TOC
        if not chapters:
            toc = doc.get_toc()
            for item in toc:
                if item[0] == 1:
                    chapters.append({"title": item[1], "start_page": item[2]})

    # 3. CALCULATE END PAGES
    if chapters:
        chapters.sort(key=lambda x: x['start_page'])
        for k in range(len(chapters)):
            if k < len(chapters) - 1:
                chapters[k]['end_page'] = chapters[k+1]['start_page'] - 1
            else:
                chapters[k]['end_page'] = 9999
    
    return chapters

# ==========================================
# STEP 3: PROCESS PDF
# ==========================================
def extract_full_data(pdf_path, doc_name):
    doc = fitz.open(pdf_path)
    
    # Get Chapters (Manual or Auto)
    chapters = get_chapters(doc, doc_name)
    
    img_output_dir = os.path.join(OUTPUT_FOLDER, doc_name, "images")
    if not os.path.exists(img_output_dir): os.makedirs(img_output_dir)
    
    questions_db = defaultdict(lambda: {
        "id": 0, "text": "", "options": {}, "images": [], 
        "correct": None, "explanation": "", "page_found": 0
    })
    
    current_q_id = None
    current_sol_id = None

    # Scan Pages
    for page_num, page in enumerate(doc):
        actual_page_num = page_num + 1
        
        # Images
        image_list = page.get_images(full=True)
        page_images = []
        for img_idx, img in enumerate(image_list):
            try:
                xref = img[0]
                base = doc.extract_image(xref)
                if len(base["image"]) < 3000: continue 
                fname = f"{doc_name}_p{actual_page_num}_img{img_idx}.{base['ext']}"
                with open(os.path.join(img_output_dir, fname), "wb") as f:
                    f.write(base["image"])
                page_images.append(f"images/{fname}")
            except: pass

        # Text
        blocks = page.get_text("blocks")
        for b in blocks:
            text = clean_text(b[4])
            
            q_match = Q_PATTERN.match(text)
            if q_match:
                current_q_id = q_match.group(1)
                current_sol_id = None
                questions_db[current_q_id]["id"] = int(current_q_id)
                questions_db[current_q_id]["page_found"] = actual_page_num
                questions_db[current_q_id]["text"] += Q_PATTERN.sub("", text).strip() + " "
                if page_images:
                    for img in page_images:
                        if img not in questions_db[current_q_id]["images"]:
                            questions_db[current_q_id]["images"].append(img)
                    page_images = []
                continue
            
            opt_match = OPT_PATTERN.match(text)
            if opt_match and current_q_id and not current_sol_id:
                questions_db[current_q_id]["options"][opt_match.group(1).lower()] = opt_match.group(2).strip()
                continue
            
            sol_match = SOL_PATTERN.match(text)
            if sol_match:
                current_sol_id = sol_match.group(1)
                current_q_id = None
                questions_db[current_sol_id]["explanation"] += SOL_PATTERN.sub("", text).strip() + " "
                continue
            
            key_match = KEY_PATTERN.match(text)
            if key_match:
                if key_match.group(1) in questions_db:
                    questions_db[key_match.group(1)]["correct"] = key_match.group(2).lower()
                continue
            
            if current_sol_id:
                questions_db[current_sol_id]["explanation"] += text + " "
            elif current_q_id:
                questions_db[current_q_id]["text"] += text + " "

    # Organize
    all_questions = sorted(questions_db.values(), key=lambda x: x['id'])
    final_structure = []

    if chapters:
        for chap in chapters:
            chap_qs = [q for q in all_questions if chap['start_page'] <= q['page_found'] <= chap['end_page']]
            if chap_qs:
                final_structure.append({"title": chap['title'], "questions": chap_qs})
    else:
        # Fallback Auto-Chunk
        chunk_size = 50
        for i in range(0, len(all_questions), chunk_size):
            chunk = all_questions[i:i + chunk_size]
            if chunk:
                final_structure.append({"title": f"Questions {chunk[0]['id']} - {chunk[-1]['id']}", "questions": chunk})

    return final_structure

# ==========================================
# SAVE OUTPUT
# ==========================================
def save_outputs(doc_name, structure):
    doc_dir = os.path.join(OUTPUT_FOLDER, doc_name)
    with open(os.path.join(doc_dir, "data.json"), "w", encoding="utf-8") as f:
        json.dump(structure, f, indent=4)

    html = f"<html><head><title>{doc_name}</title><style>body{{font-family:sans-serif;padding:20px;background:#f4f4f9}}.chapter{{background:white;padding:20px;margin-bottom:30px}}.q{{border-bottom:1px solid #ddd;padding:15px}}.correct{{background:#d4edda}}</style></head><body><h1>{doc_name}</h1>"
    for chap in structure:
        html += f"<div class='chapter'><h2>{chap['title']}</h2>"
        for q in chap['questions']:
            opts = "".join([f"<div class='{'correct' if k==q['correct'] else ''}'>{k}) {v}</div>" for k,v in q['options'].items()])
            imgs = "".join([f"<img src='{i}' width='200'><br>" for i in q['images']])
            html += f"<div class='q'><p><b>Q{q['id']}:</b> {q['text']}</p>{imgs}{opts}<p><i>{q['explanation'][:100]}...</i></p></div>"
        html += "</div>"
    html += "</body></html>"
    with open(os.path.join(doc_dir, "view.html"), "w", encoding="utf-8") as f:
        f.write(html)

# RUN
if not os.path.exists(OUTPUT_FOLDER): os.makedirs(OUTPUT_FOLDER)
files = [f for f in os.listdir(INPUT_FOLDER) if f.endswith(".pdf")]
print(f"📂 Found {len(files)} PDFs...")
if os.path.exists(MANUAL_INDEX_FILE): print("📂 Found 'chapters.txt' manual index file!")

for f in files:
    name = f.replace(".pdf", "").replace(" ", "_")
    print(f"📘 Processing: {name}")
    data = extract_full_data(os.path.join(INPUT_FOLDER, f), name)
    save_outputs(name, data)
    print("   ✅ Done")