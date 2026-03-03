const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const PORT = 5000;
const OLLAMA_MODEL = 'qwen3-vl:2b';
const OLLAMA_HOST = 'http://localhost:11434';

const NUTRITION_PROMPT = `Extract nutrition facts from this label. Return ONLY valid JSON, no explanations:
{"brand":"kirkland","product":"milk","calories":150,"protein":8,"carbs":12,"fat":8,"saturatedFat":5,"sodium":125,"fiber":0,"sugars":12,"addedSugars":0}`;

// Convert file to base64 and remove newlines
function fileToBase64(filePath) {
  const bitmap = fs.readFileSync(filePath);
  return bitmap.toString('base64').replace(/\n/g, '');
}

// Call Ollama API with the image
function callOllama(imagePath) {
  return new Promise((resolve, reject) => {
    const base64Image = fileToBase64(imagePath);
    console.log('Image size:', base64Image.length, 'chars');
    console.log('Using model:', OLLAMA_MODEL);
    
    const data = JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [
        {
          role: 'user',
          content: NUTRITION_PROMPT,
          images: [base64Image]
        }
      ],
      stream: false,
      thinking: false
    });

    const options = {
      hostname: 'localhost',
      port: 11434,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    console.log('Calling Ollama API with model:', OLLAMA_MODEL);

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        // Clean up uploaded file
        try {
          fs.unlinkSync(imagePath);
        } catch (e) {
          console.log('File cleanup error:', e.message);
        }

        try {
          const parsed = JSON.parse(responseData);
          let content = '';
          
          if (parsed.message) {
            // Check content first, then fall back to thinking
            content = parsed.message.content || parsed.message.thinking || '';
          }
          
          if (content) {
            resolve(content);
          } else if (parsed.error) {
            reject(new Error(parsed.error));
          } else {
            reject(new Error('No content in response: ' + responseData));
          }
        } catch (e) {
          reject(new Error('Failed to parse response: ' + e.message));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(data);
    req.end();
  });
}

// Extract a number value by field name - handles any format
function extractNumber(text, fieldName) {
  const patterns = [
    new RegExp(`"${fieldName}"\\s*:\\s*(\\d+\\.?\\d*)`, 'i'),
    new RegExp(`${fieldName}\\s*[:=]\\s*(\\d+\\.?\\d*)`, 'i'),
    new RegExp(`${fieldName}\\s+(\\d+\\.?\\d*)\\s*(?:g|mg|kcal)?`, 'i'),
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseFloat(match[1]);
    }
  }
  return 0;
}

// Extract a text value by field name
function extractText(text, fieldName) {
  const patterns = [
    new RegExp(`"${fieldName}"\\s*:\\s*"([^"]+)"`, 'i'),
    new RegExp(`${fieldName}\\s*[:=]\\s*([^,\\n]+)`, 'i'),
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  return '';
}

// Parse the JSON response from Ollama using individual field extraction
function parseNutritionResponse(response) {
  console.log('Parsing response...');
  
  const nutrition = {
    brand: extractText(response, 'brand'),
    product: extractText(response, 'product'),
    calories: Math.round(extractNumber(response, 'calories') || 0),
    protein: Math.round((extractNumber(response, 'protein') || 0) * 10) / 10,
    carbs: Math.round((extractNumber(response, 'carbohydrates') || extractNumber(response, 'carbs') || 0) * 10) / 10,
    fat: Math.round((extractNumber(response, 'fat') || 0) * 10) / 10,
    saturatedFat: Math.round((extractNumber(response, 'saturated[-_ ]?fat') || 0) * 10) / 10,
    sodium: Math.round((extractNumber(response, 'sodium') || 0) * 10) / 10,
    fiber: Math.round((extractNumber(response, 'fiber') || extractNumber(response, 'fibre') || 0) * 10) / 10,
    sugars: Math.round((extractNumber(response, 'sugars') || 0) * 10) / 10,
    addedSugars: Math.round((extractNumber(response, 'added[-_ ]?sugars') || 0) * 10) / 10,
  };
  
  // Log what was extracted for debugging
  console.log('Extracted nutrition:', nutrition);
  
  return nutrition;
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Main extraction endpoint
app.post('/extract', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image provided' });
  }

  try {
    console.log('Processing image:', req.file.path);
    
    const ollamaResponse = await callOllama(req.file.path);
    console.log('Ollama raw response:\n', ollamaResponse);
    
    const nutrition = parseNutritionResponse(ollamaResponse);
    console.log('Extracted nutrition:', nutrition);
    
    res.json({
      success: true,
      nutrition,
      raw: ollamaResponse
    });
  } catch (error) {
    console.error('Extraction error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`VLM Server running on http://localhost:${PORT}`);
  console.log(`Using model: ${OLLAMA_MODEL}`);
  console.log('Make sure Ollama is running: ollama serve');
});
