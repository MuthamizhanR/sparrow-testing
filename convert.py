import os
import json
import shutil
from pypdf import PdfReader
from pypdf.generic import NameObject, IndirectObject

# ==========================================
# SETUP FOLDERS
# ==========================================
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FOLDER = os.path.join(SCRIPT_DIR, "Put_PDFs_Here")
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "MedTrix_Website")

if not os.path.exists(INPUT_FOLDER):
    os.makedirs(INPUT_FOLDER)
    print(f"⚠️ Created folder: {INPUT_FOLDER}")
    print("Please put your PDFs inside it and run again.")
    exit()

if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

# ==========================================
# DEEP IMAGE EXTRACTOR (The Fix)
# ==========================================
def extract_images_deep(page, page_num, output_folder, doc_name):
    """
    Digs into page resources to find hidden images.
    """
    if '/Resources' not in page:
        return []

    resources = page['/Resources']
    if '/XObject' not in resources:
        return []

    xObject = resources['/XObject']
    # Resolve indirect object if necessary
    if isinstance(xObject, IndirectObject):
        xObject = xObject.get_object()

    saved_images = []

    for obj_name in xObject:
        obj = xObject[obj_name]
        if isinstance(obj, IndirectObject):
            obj = obj.get_object()

        # If it's an image
        if obj['/Subtype'] == '/Image':
            try:
                # Determine extension
                extension = "jpg" # Default
                if '/Filter' in obj:
                    if '/FlateDecode' in obj['/Filter']:
                        extension = "png"
                    elif '/JPXDecode' in obj['/Filter']:
                        extension = "jp2"
                
                # Generate filename
                image_name = f"{doc_name}_p{page_num+1}_{obj_name[1:]}.{extension}"
                image_path = os.path.join(output_folder, image_name)
                
                # Extract raw data and save
                with open(image_path, "wb") as img_file:
                    img_file.write(obj.get_data())
                
                saved_images.append(f"images/{image_name}")
                print(f"      📸 Found image: {image_name}")

            except Exception as e:
                print(f"      ⚠️ Skipped an image on page {page_num+1}: {e}")

    return saved_images

# ==========================================
# MAIN PROCESSING
# ==========================================
def clean_text(text):
    if not text: return ""
    import re
    # Remove garbage characters
    text = text.replace("\u00a0", " ").replace("â", "").replace("€", "")
    text = re.sub(r'\s+', ' ', text).strip()
    return text

print(f"📂 Scanning: {INPUT_FOLDER}")
pdf_files = [f for f in os.listdir(INPUT_FOLDER) if f.endswith('.pdf')]

if not pdf_files:
    print("❌ No PDFs found. Please check the folder.")
else:
    print(f"🚀 Processing {len(pdf_files)} files...")
    
    index_links = []

    for pdf_file in pdf_files:
        doc_name = pdf_file.replace(".pdf", "").replace(" ", "_")
        print(f"\n📘 Reading: {doc_name}")
        
        # Create doc folders
        doc_out_path = os.path.join(OUTPUT_DIR, doc_name)
        img_out_path = os.path.join(doc_out_path, "images")
        if not os.path.exists(img_out_path):
            os.makedirs(img_out_path)
            
        try:
            reader = PdfReader(os.path.join(INPUT_FOLDER, pdf_file))
            
            quiz_data = []
            full_text = ""

            # --- SCAN PAGES ---
            for i, page in enumerate(reader.pages):
                # 1. Get Text
                page_text = clean_text(page.extract_text())
                full_text += page_text + "\n"
                
                # 2. Get Images (Deep Scan)
                page_images = extract_images_deep(page, i, img_out_path, doc_name)
                
                # 3. Find Questions on this page
                # This is a simple finder. If "Question X" is on this page, 
                # we attach the images found on this page to it.
                import re
                q_matches = re.findall(r"(Question\s+\d+)", page_text, re.IGNORECASE)
                
                if q_matches:
                    # If we found a question header, create a basic question entry
                    # We attach ALL images found on this page to this question entry
                    for q_header in q_matches:
                        quiz_data.append({
                            "text": f"{q_header} (See images)",
                            "images": page_images,
                            # Placeholder options/answers since we are just testing image extraction
                            "options": {"a": "Option A", "b": "Option B"}, 
                            "correct": "a",
                            "explanation": "Explanation extracted from end of file."
                        })

            # --- GENERATE HTML ---
            json_str = json.dumps(quiz_data)
            html = f"""
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>{doc_name}</title>
                <style>
                    body {{ font-family: sans-serif; padding: 20px; background:#f4f4f9; }}
                    .card {{ background:white; padding:20px; margin-bottom:20px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.1); }}
                    img {{ max-width:100%; border-radius:5px; margin:10px 0; border:1px solid #ddd; }}
                    .btn {{ display:block; padding:10px; background:#007bff; color:white; text-align:center; text-decoration:none; border-radius:5px; }}
                </style>
            </head>
            <body>
                <h1>{doc_name}</h1>
                <a href="../index.html" class="btn">Back to Home</a>
                <div id="quiz"></div>
                <script>
                    const data = {json_str};
                    const div = document.getElementById('quiz');
                    data.forEach(q => {{
                        let imgs = '';
                        if(q.images) q.images.forEach(src => imgs += `<img src="${{src}}"><br>`);
                        
                        div.innerHTML += `
                            <div class="card">
                                <h3>${{q.text}}</h3>
                                ${{imgs}}
                                <p><i>(Text extraction simplified for image test)</i></p>
                            </div>
                        `;
                    }});
                </script>
            </body>
            </html>
            """
            
            with open(os.path.join(doc_out_path, f"{doc_name}.html"), "w", encoding="utf-8") as f:
                f.write(html)
                
            index_links.append(f'<li><a href="{doc_name}/{doc_name}.html">{doc_name}</a></li>')
            print(f"   ✅ Saved HTML. Check the 'images' folder inside {doc_name} to see if they appeared.")

        except Exception as e:
            print(f"   ❌ Failed: {e}")

    # Create Index
    with open(os.path.join(OUTPUT_DIR, "index.html"), "w") as f:
        f.write(f"<h1>My Quiz Library</h1><ul>{''.join(index_links)}</ul>")

    print("\n🎉 DONE! Go check the 'MedTrix_Website' folder.")