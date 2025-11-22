import os
import re
import json
import fitz  # PyMuPDF (for Images)
import pdfplumber # (for Text - handles broken fonts better)
from collections import defaultdict

# ==========================================
# 1. CONFIGURATION & SETUP
# ==========================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FOLDER = os.path.join(BASE_DIR, "Put_PDFs_Here")
OUTPUT_FOLDER = os.path.join(BASE_DIR, "MedTrix_Engine_Data")
MANUAL_INDEX_FILE = os.path.join(BASE_DIR, "chapters.txt")

# Regex Patterns
Q_PATTERN = re.compile(r"^Question\s+(\d+)\s*[:\.]", re.IGNORECASE)
OPT_PATTERN = re.compile(r"^([a-d])\)\s+(.*)", re.IGNORECASE)
SOL_PATTERN = re.compile(r"^Solution to Question\s+(\d+)\s*[:\.]", re.IGNORECASE)
KEY_PATTERN = re.compile(r"^(\d+)\s+([a-d])$", re.IGNORECASE)

def clean_text(text):
    """Cleans text using pdfplumber's advanced decoding."""
    if not text: return ""
    # Basic cleanup
    text = text.replace("â", "'").replace("€", "").replace("\u00a0", " ")
    text = re.sub(r'\s+', ' ', text).strip()
    return text

# ==========================================
# 2. MANUAL CHAPTER LOADING
# ==========================================
def load_manual_chapters():
    manual_data = {}
    if not os.path.exists(MANUAL_INDEX_FILE): return manual_data

    current_subject = None
    with open(MANUAL_INDEX_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line: continue
            if line.startswith("[") and line.endswith("]"):
                current_subject = line[1:-1].strip()
                manual_data[current_subject] = []
                continue
            match = re.search(r"^(.*?)\s+(\d+)$", line)
            if match and current_subject:
                title = re.sub(r"^\d+[\.\s]*", "", match.group(1).strip())
                manual_data[current_subject].append({
                    "title": title, "start_page": int(match.group(2))
                })
    return manual_data

MANUAL_CHAPTERS = load_manual_chapters()

# ==========================================
# 3. HYBRID EXTRACTION ENGINE
# ==========================================
def extract_full_data(pdf_path, doc_name):
    # 1. Open with PyMuPDF for IMAGES
    doc_fitz = fitz.open(pdf_path)
    # 2. Open with pdfplumber for TEXT (Better encoding handling)
    doc_plumb = pdfplumber.open(pdf_path)
    
    img_output_dir = os.path.join(OUTPUT_FOLDER, doc_name, "images")
    if not os.path.exists(img_output_dir): os.makedirs(img_output_dir)
    
    # Determine Chapters
    chapters = []
    if doc_name in MANUAL_CHAPTERS:
        print(f"   ✅ Using Manual Index for {doc_name}")
        chapters = MANUAL_CHAPTERS[doc_name]
    else:
        # Fallback: Auto-chunking (Simpler for now to avoid regex complexity with broken fonts)
        pass 

    # Calculate End Pages
    if chapters:
        chapters.sort(key=lambda x: x['start_page'])
        for k in range(len(chapters)):
            if k < len(chapters) - 1:
                chapters[k]['end_page'] = chapters[k+1]['start_page'] - 1
            else:
                chapters[k]['end_page'] = 9999

    questions_db = defaultdict(lambda: {
        "id": 0, "text": "", "options": {}, "images": [], 
        "correct": None, "explanation": "", "page_found": 0
    })
    
    current_q_id = None
    current_sol_id = None
    
    print(f"   ...Processing {len(doc_plumb.pages)} pages (Hybrid Engine)...")

    # Loop through pages using pdfplumber
    for i, page_plumb in enumerate(doc_plumb.pages):
        page_num = i + 1
        
        # --- A. EXTRACT IMAGES (Using PyMuPDF) ---
        # We use the matching page index from the fitz document
        page_fitz = doc_fitz[i]
        image_list = page_fitz.get_images(full=True)
        page_images = []
        
        for img_idx, img in enumerate(image_list):
            try:
                xref = img[0]
                base = doc_fitz.extract_image(xref)
                if len(base["image"]) < 3000: continue 
                fname = f"{doc_name}_p{page_num}_img{img_idx}.{base['ext']}"
                with open(os.path.join(img_output_dir, fname), "wb") as f:
                    f.write(base["image"])
                page_images.append(f"images/{fname}")
            except: pass

        # --- B. EXTRACT TEXT (Using pdfplumber) ---
        # pdfplumber handles the broken unicode mapping much better
        text = page_plumb.extract_text()
        if not text: continue
        
        # Split text into lines to process logic
        lines = text.split('\n')
        
        for line in lines:
            line = clean_text(line)
            
            # Question Header
            q_match = Q_PATTERN.match(line)
            if q_match:
                current_q_id = q_match.group(1)
                current_sol_id = None
                questions_db[current_q_id]["id"] = int(current_q_id)
                questions_db[current_q_id]["page_found"] = page_num
                
                questions_db[current_q_id]["text"] += Q_PATTERN.sub("", line).strip() + " "
                
                # Attach images found on this page
                if page_images:
                    for img in page_images:
                        if img not in questions_db[current_q_id]["images"]:
                            questions_db[current_q_id]["images"].append(img)
                    page_images = [] # Clear so they don't attach to next question
                continue
            
            # Options
            opt_match = OPT_PATTERN.match(line)
            if opt_match and current_q_id and not current_sol_id:
                questions_db[current_q_id]["options"][opt_match.group(1).lower()] = opt_match.group(2).strip()
                continue
            
            # Explanations
            sol_match = SOL_PATTERN.match(line)
            if sol_match:
                current_sol_id = sol_match.group(1)
                current_q_id = None
                questions_db[current_sol_id]["explanation"] += SOL_PATTERN.sub("", line).strip() + " "
                continue
            
            # Answer Key Table
            key_match = KEY_PATTERN.match(line)
            if key_match:
                q_num = key_match.group(1)
                ans = key_match.group(2).lower()
                if q_num in questions_db:
                    questions_db[q_num]["correct"] = ans
                continue
            
            # Append Text to Body
            if current_sol_id:
                questions_db[current_sol_id]["explanation"] += line + " "
            elif current_q_id:
                questions_db[current_q_id]["text"] += line + " "

    doc_fitz.close()
    doc_plumb.close()

    # 4. ORGANIZE
    all_questions = sorted(questions_db.values(), key=lambda x: x['id'])
    final_structure = []

    if chapters:
        for chap in chapters:
            chap_qs = [q for q in all_questions if chap['start_page'] <= q['page_found'] <= chap['end_page']]
            if chap_qs:
                final_structure.append({"title": chap['title'], "questions": chap_qs})
    else:
        # Auto Chunking
        chunk_size = 50
        for i in range(0, len(all_questions), chunk_size):
            chunk = all_questions[i:i + chunk_size]
            if chunk:
                final_structure.append({"title": f"Questions {chunk[0]['id']} - {chunk[-1]['id']}", "questions": chunk})

    return final_structure

# ==========================================
# 4. SAVING
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

def generate_master_index():
    print("\n📊 Generating Master Index...")
    subjects = []
    if os.path.exists(OUTPUT_FOLDER):
        for d in sorted(os.listdir(OUTPUT_FOLDER)):
            dir_path = os.path.join(OUTPUT_FOLDER, d)
            if os.path.isdir(dir_path) and os.path.exists(os.path.join(dir_path, "data.json")):
                q_count = 0
                try:
                    with open(os.path.join(dir_path, "data.json"), 'r') as f:
                        for chap in json.load(f): q_count += len(chap.get('questions', []))
                except: pass
                subjects.append({"name": d, "count": q_count, "link": f"{d}/view.html"})

    html = "<html><head><style>body{font-family:sans-serif;padding:40px;background:#f4f4f9}.card{background:white;padding:20px;margin:10px;border-radius:8px;box-shadow:0 2px 5px rgba(0,0,0,0.1);display:inline-block;width:200px}a{text-decoration:none;color:#333}h3{color:#007bff}</style></head><body><h1>MedTrix Engine</h1>"
    for sub in subjects:
        html += f"<a href='{sub['link']}'><div class='card'><h3>{sub['name']}</h3><p>{sub['count']} MCQs</p></div></a>"
    html += "</body></html>"
    with open(os.path.join(OUTPUT_FOLDER, "index.html"), "w", encoding="utf-8") as f:
        f.write(html)

# ==========================================
# 5. EXECUTION
# ==========================================
if __name__ == "__main__":
    if not os.path.exists(INPUT_FOLDER):
        os.makedirs(INPUT_FOLDER)
        print(f"⚠️ Created '{INPUT_FOLDER}'.")
        exit()
    if not os.path.exists(OUTPUT_FOLDER): os.makedirs(OUTPUT_FOLDER)

    files = [f for f in os.listdir(INPUT_FOLDER) if f.endswith(".pdf")]
    print(f"📂 Found {len(files)} PDFs...")

    for f in files:
        name = f.replace(".pdf", "").replace(" ", "_")
        print(f"\n📘 Processing: {name}")
        try:
            data = extract_full_data(os.path.join(INPUT_FOLDER, f), name)
            save_outputs(name, data)
            print(f"   ✅ Done")
        except Exception as e:
            print(f"   ❌ Failed: {e}")

    generate_master_index()
    print("\n🎉 ALL DONE!")