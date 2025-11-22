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

# Regex to find "Question X:"
Q_PATTERN = re.compile(r"^Question\s+(\d+)\s*[:\.]", re.IGNORECASE)
# Regex to find Options "a) ..."
OPT_PATTERN = re.compile(r"^([a-d])\)\s+(.*)", re.IGNORECASE)
# Regex to find Explanations
SOL_PATTERN = re.compile(r"^Solution to Question\s+(\d+)\s*[:\.]", re.IGNORECASE)
# Regex to find Answer Keys in tables "1 c"
KEY_PATTERN = re.compile(r"^(\d+)\s+([a-d])$", re.IGNORECASE)

def clean_text(text):
    if not text: return ""
    text = text.replace("â", "'").replace("€", "").replace("\u00a0", " ")
    text = re.sub(r'\s+', ' ', text).strip()
    return text

# ==========================================
# STEP 1: SMART TABLE OF CONTENTS
# ==========================================
def extract_chapters_from_pdf(doc):
    """
    Tries multiple strategies to find chapters.
    Returns: [{'title': 'Topic', 'start_page': 5, 'end_page': 10}, ...]
    """
    chapters = []
    
    # Regex 1: Standard "1  Introduction  5"
    # Regex 2: Dotted "Introduction .......... 5"
    patterns = [
        re.compile(r"^\s*(\d+)\.?\s+(.+?)\s+(\d+)\s*$"),
        re.compile(r"^\s*(.+?)\s+\.{2,}\s*(\d+)\s*$")
    ]

    print("   ...Scanning for Chapters...")

    # Scan first 10 pages for Index/Contents
    start_scan_page = -1
    for i in range(min(10, len(doc))):
        text = doc[i].get_text("text").lower()
        if any(x in text for x in ["contents", "index", "syllabus", "topic"]):
            start_scan_page = i
            break
    
    if start_scan_page != -1:
        # Scan the page found + the next 2 pages (in case index is long)
        for i in range(start_scan_page, min(start_scan_page + 3, len(doc))):
            page_lines = doc[i].get_text("text").split('\n')
            for line in page_lines:
                line = clean_text(line)
                if not line: continue

                # Try matching our patterns
                for pat in patterns:
                    match = pat.match(line)
                    if match:
                        # If pattern has 3 groups, it's "Num Title Page"
                        if len(match.groups()) == 3:
                            title = match.group(2).strip()
                            page_num = int(match.group(3))
                        # If pattern has 2 groups, it's "Title.... Page"
                        else:
                            title = match.group(1).strip()
                            page_num = int(match.group(2))
                        
                        # Basic sanity check: Title shouldn't be a number, Page shouldn't be 0
                        if len(title) > 2 and page_num > 0:
                            chapters.append({
                                "title": title,
                                "start_page": page_num
                            })
                        break

    # Fallback: PDF Metadata Bookmarks (if OCR failed)
    if not chapters:
        toc = doc.get_toc()
        for item in toc:
            if item[0] == 1: # Level 1 headers
                chapters.append({"title": item[1], "start_page": item[2]})

    # Calculate End Pages
    if chapters:
        # Sort by page number just in case
        chapters.sort(key=lambda x: x['start_page'])
        for k in range(len(chapters)):
            if k < len(chapters) - 1:
                chapters[k]['end_page'] = chapters[k+1]['start_page'] - 1
            else:
                chapters[k]['end_page'] = 9999 # Last chapter goes to end
        print(f"   ✅ Found {len(chapters)} chapters via TOC.")
    else:
        print("   ⚠️ No TOC found. Will auto-chunk later.")
        
    return chapters

# ==========================================
# STEP 2: EXTRACT CONTENT
# ==========================================
def extract_full_data(pdf_path, doc_name):
    doc = fitz.open(pdf_path)
    
    # 1. Get Chapters
    chapters = extract_chapters_from_pdf(doc)
    
    # 2. Setup Output
    img_output_dir = os.path.join(OUTPUT_FOLDER, doc_name, "images")
    if not os.path.exists(img_output_dir): os.makedirs(img_output_dir)
    
    questions_db = defaultdict(lambda: {
        "id": 0, "text": "", "options": {}, "images": [], 
        "correct": None, "explanation": "", "page_found": 0
    })
    
    current_q_id = None
    current_sol_id = None

    # 3. Iterate Pages
    # print(f"   ...Processing {len(doc)} pages...") # Commented out to reduce spam
    for page_num, page in enumerate(doc):
        actual_page_num = page_num + 1
        
        # --- IMAGE EXTRACTION ---
        image_list = page.get_images(full=True)
        page_images = []
        for img_idx, img in enumerate(image_list):
            try:
                xref = img[0]
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                ext = base_image["ext"]
                if len(image_bytes) < 3000: continue # Skip tiny icons

                fname = f"{doc_name}_p{actual_page_num}_img{img_idx}.{ext}"
                fpath = os.path.join(img_output_dir, fname)
                
                with open(fpath, "wb") as f:
                    f.write(image_bytes)
                
                page_images.append(f"images/{fname}")
            except: pass

        # --- TEXT EXTRACTION ---
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

    # 4. ORGANIZE INTO CHAPTERS
    all_questions = sorted(questions_db.values(), key=lambda x: x['id'])
    final_structure = []

    if chapters:
        # We have TOC, bucket them
        for chap in chapters:
            chap_qs = [q for q in all_questions if chap['start_page'] <= q['page_found'] <= chap['end_page']]
            if chap_qs:
                final_structure.append({
                    "title": chap['title'],
                    "questions": chap_qs
                })
    else:
        # FALLBACK: Auto-Chunking (The Fix for Pediatrics/Ortho)
        print(f"   ⚠️ Auto-chunking {len(all_questions)} questions into sets of 50...")
        chunk_size = 50
        for i in range(0, len(all_questions), chunk_size):
            chunk = all_questions[i:i + chunk_size]
            if not chunk: continue
            final_structure.append({
                "title": f"Questions {chunk[0]['id']} - {chunk[-1]['id']}",
                "questions": chunk
            })

    return final_structure

# ==========================================
# STEP 3: GENERATE OUTPUTS
# ==========================================
def save_outputs(doc_name, structure):
    doc_dir = os.path.join(OUTPUT_FOLDER, doc_name)
    with open(os.path.join(doc_dir, "data.json"), "w", encoding="utf-8") as f:
        json.dump(structure, f, indent=4)

    html = f"""<html><head><title>{doc_name}</title>
    <style>
        body{{font-family:sans-serif;padding:20px;background:#f4f4f9}}
        .chapter{{background:white;padding:20px;margin-bottom:30px;border-radius:8px;box-shadow:0 2px 5px rgba(0,0,0,0.1)}}
        .h2{{color:#007bff;border-bottom:2px solid #007bff;padding-bottom:10px}}
        .q{{margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #eee}}
        .img{{max-width:400px;display:block;margin:10px 0;border:1px solid #ccc}}
        .opt{{margin:5px 0;padding:5px}}
        .correct{{background-color:#d4edda;font-weight:bold}}
        .exp{{background:#fff3cd;padding:10px;margin-top:10px;font-size:0.9em}}
    </style></head><body><h1>{doc_name}</h1>"""

    for chap in structure:
        html += f"<div class='chapter'><h2 class='h2'>{chap['title']}</h2>"
        for q in chap['questions']:
            img_html = "".join([f"<img src='{img}' class='img'>" for img in q['images']])
            opts_html = "".join([f"<div class='opt {'correct' if k==q['correct'] else ''}'>{k}) {v}</div>" for k,v in q['options'].items()])
            html += f"<div class='q'><p><b>Q{q['id']}:</b> {q['text']}</p>{img_html}{opts_html}<div class='exp'><b>Exp:</b> {q['explanation'][:300]}...</div></div>"
        html += "</div>"
    html += "</body></html>"
    
    with open(os.path.join(doc_dir, "view.html"), "w", encoding="utf-8") as f:
        f.write(html)

# ==========================================
# MAIN RUNNER
# ==========================================
if not os.path.exists(INPUT_FOLDER):
    os.makedirs(INPUT_FOLDER)
    print("Created input folder.")
    exit()

files = [f for f in os.listdir(INPUT_FOLDER) if f.endswith(".pdf")]
print(f"📂 Found {len(files)} PDFs...")

for f in files:
    name = f.replace(".pdf", "").replace(" ", "_")
    path = os.path.join(INPUT_FOLDER, f)
    print(f"\n📘 Processing: {name}")
    data = extract_full_data(path, name)
    save_outputs(name, data)
    print(f"   ✅ Done! Saved to MedTrix_Engine_Data/{name}/")