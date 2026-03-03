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

const NUTRITION_PROMPT = `Extract nutrition facts from this label. Return JSON with: brand, product, calories, protein, carbs, fat, saturatedFat, sodium, fiber, sugars, addedSugars. Use null for missing values.`;

// JSON Schema for structured output
const NUTRITION_SCHEMA = {
  type: 'object',
  properties: {
    brand: { type: 'string', nullable: true },
    product: { type: 'string', nullable: true },
    calories: { type: 'number', nullable: true },
    protein: { type: 'number', nullable: true },
    carbs: { type: 'number', nullable: true },
    fat: { type: 'number', nullable: true },
    saturatedFat: { type: 'number', nullable: true },
    sodium: { type: 'number', nullable: true },
    fiber: { type: 'number', nullable: true },
    sugars: { type: 'number', nullable: true },
    addedSugars: { type: 'number', nullable: true },
  },
  required: [],
};

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
      thinking: false,
      format: NUTRITION_SCHEMA
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

// Parse the JSON response from Ollama - should be valid JSON with schema
function parseNutritionResponse(response) {
  console.log('Parsing response...');
  
  // Try to parse as direct JSON first (schema ensures valid format)
  try {
    const parsed = JSON.parse(response);
    
    // Ensure all required fields exist with defaults
    return {
      brand: parsed.brand || '',
      product: parsed.product || '',
      calories: Math.round(Number(parsed.calories) || 0),
      protein: Math.round((Number(parsed.protein) || 0) * 10) / 10,
      carbs: Math.round((Number(parsed.carbs) || 0) * 10) / 10,
      fat: Math.round((Number(parsed.fat) || 0) * 10) / 10,
      saturatedFat: Math.round((Number(parsed.saturatedFat) || 0) * 10) / 10,
      sodium: Math.round((Number(parsed.sodium) || 0) * 10) / 10,
      fiber: Math.round((Number(parsed.fiber) || 0) * 10) / 10,
      sugars: Math.round((Number(parsed.sugars) || 0) * 10) / 10,
      addedSugars: Math.round((Number(parsed.addedSugars) || 0) * 10) / 10,
    };
  } catch (error) {
    console.error('JSON parse error:', error.message);
    console.error('Raw response:', response.substring(0, 500));
    throw new Error(`Failed to parse JSON: ${error.message}`);
  }
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
