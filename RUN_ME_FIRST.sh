#!/bin/bash
echo "🚀 Starting Psychiatry PDF to MCQ Engine Conversion..."
echo ""

echo "📦 Installing dependencies..."
npm install

echo ""
echo "📚 Creating directory structure..."
mkdir -p pdf_files extracted_data mcq_engine_data

echo ""
echo "✅ SETUP COMPLETE!"
echo ""
echo "📋 NEXT STEPS:"
echo "1. Copy ALL your PDF files to the 'pdf_files' folder"
echo "2. Run: npm run extract"
echo "3. Then run: npm run convert" 
echo "4. Finally run: npm run build"
echo ""
echo "🎯 You will get a complete MCQ engine in 'psychiatry-mcq-engine' folder!"
echo ""
echo "💡 Quick command to run everything: npm run all"
