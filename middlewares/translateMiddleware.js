// require("dotenv").config();
// const AWS = require("aws-sdk");

// // Configure AWS Translate
// const translate = new AWS.Translate({ region: process.env.AWS_DEFAULT_REGION });


// const PHRASES_TO_STANDARDIZE = [
//     { variants: ["हिंद सेना", "हिन्द सेना"], replacement: "Hind Sena" },
//   ];
  
//   function maskPhrases(text, targetLang) {
//     if (targetLang !== "en") return text;
  
//     let masked = text;
//     PHRASES_TO_STANDARDIZE.forEach(({ variants, replacement }) => {
//       variants.forEach((variant) => {
//         masked = masked.replaceAll(variant, replacement);
//       });
//     });
//     return masked;
//   }
  
//   function unmaskPhrases(text) {
//     return text;
//   }
  

// const EXCLUDED_FIELDS = new Set([
//   "token",
//   "fcmToken",
//   "uri",
//   "image",
//   "isMember",
//   "dateOfJoining",
//   "isSocialLogin",
//   "createDate",
//   "updatedDate",
// ]);

// const translationCache = new Map();
// const MAX_CACHE_SIZE = 1000;

// function safeCacheSet(key, value) {
//   if (translationCache.size >= MAX_CACHE_SIZE) {
//     const oldestKey = translationCache.keys().next().value;
//     translationCache.delete(oldestKey);
//   }
//   translationCache.set(key, value);
// }

// function detectLanguage(text) {
//   return /[\u0900-\u097F]/.test(text) ? "hi" : "en";
// }

// const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// function splitLongText(text, maxBytes) {
//   const parts = [];
//   let part = "",
//     size = 0;

//   for (const word of text.split(" ")) {
//     const wordSize = Buffer.byteLength(word + " ", "utf-8");
//     if (size + wordSize > maxBytes) {
//       parts.push(part.trim());
//       part = word + " ";
//       size = wordSize;
//     } else {
//       part += word + " ";
//       size += wordSize;
//     }
//   }
//   if (part.trim()) parts.push(part.trim());
//   return parts;
// }

// async function limitedBatch(items, limit, asyncFn) {
//   const results = [];
//   let idx = 0;
//   async function run() {
//     while (idx < items.length) {
//       const i = idx++;
//       results[i] = await asyncFn(items[i]);
//     }
//   }
//   await Promise.all(Array(limit).fill(0).map(run));
//   return results;
// }

// async function batchTranslate(texts, targetLang) {
//   if (!texts.length) return texts;

//   const translationMap = {};
//   const textsToTranslate = [];
//   const originalToMasked = new Map();
//   const maskedToOriginal = new Map();
//   const uniqueTexts = [...new Set(texts)];

//   for (const text of uniqueTexts) {
//     if (!text.trim()) {
//       translationMap[text] = text;
//     } else if (translationCache.has(text + targetLang)) {
//       translationMap[text] = translationCache.get(text + targetLang);
//     } else if (detectLanguage(text) !== targetLang) {
//       const byteSize = Buffer.byteLength(text, "utf-8");
//       if (byteSize > 8000) {
//         console.warn("Large text detected for translation:", byteSize);
//         splitLongText(text, 7500).forEach((part) => {
//           const masked = maskPhrases(part, targetLang);
//           originalToMasked.set(part, masked);
//           maskedToOriginal.set(masked, part);
//           textsToTranslate.push(masked);
//         });
//       } else {
//         const masked = maskPhrases(text, targetLang);
//         originalToMasked.set(text, masked);
//         maskedToOriginal.set(masked, text);
//         textsToTranslate.push(masked);
//       }
//     } else {
//       translationMap[text] = text;
//     }
//   }

//   const maxBytesPerBatch = 8500;
//   const batches = [];
//   let currentBatch = [],
//     currentSize = 0;

//   for (const text of textsToTranslate) {
//     const textSize = Buffer.byteLength(text, "utf-8");
//     if (currentSize + textSize > maxBytesPerBatch) {
//       batches.push(currentBatch);
//       currentBatch = [];
//       currentSize = 0;
//     }
//     currentBatch.push(text);
//     currentSize += textSize;
//   }
//   if (currentBatch.length) batches.push(currentBatch);

//   try {
//     await limitedBatch(batches, 3, async (batch) => {
//       const joined = batch.join("\n----\n");
//       const params = {
//         Text: joined,
//         SourceLanguageCode: detectLanguage(batch[0]),
//         TargetLanguageCode: targetLang,
//       };

//       let response;
//       for (let retries = 3; retries > 0; retries--) {
//         try {
//           response = await translate.translateText(params).promise();
//           break;
//         } catch (err) {
//           console.warn(`Retrying translation batch (${4 - retries})...`);
//           if (retries === 1) throw err;
//           await sleep(1000);
//         }
//       }

//       const translatedParts = response.TranslatedText.split("\n----\n");
//       batch.forEach((maskedText, i) => {
//         const originalText = maskedToOriginal.get(maskedText) || maskedText;
//         const translated = unmaskPhrases(translatedParts[i] || maskedText);
//         translationMap[originalText] = translated;
//         safeCacheSet(originalText + targetLang, translated);
//       });
//     });
//   } catch (error) {
//     console.error("Translation batch failed:", error);
//     return texts;
//   }

//   return texts.map((t) => translationMap[t] || t);
// }

// function extractStrings(obj) {
//   const texts = [],
//     paths = [];
//   function traverse(o, path = []) {
//     if (typeof o === "string") {
//       texts.push(o);
//       paths.push(path);
//     } else if (Array.isArray(o)) {
//       o.forEach((v, i) => traverse(v, [...path, i]));
//     } else if (o && typeof o === "object") {
//       Object.entries(o).forEach(([k, v]) => {
//         if (!EXCLUDED_FIELDS.has(k)) traverse(v, [...path, k]);
//       });
//     }
//   }
//   traverse(obj);
//   return { texts, paths };
// }

// function replaceStrings(obj, newTexts, paths) {
//   let index = 0;
//   function traverse(o, path = []) {
//     if (JSON.stringify(path) === JSON.stringify(paths[index])) {
//       return newTexts[index++];
//     } else if (Array.isArray(o)) {
//       return o.map((v, i) => traverse(v, [...path, i]));
//     } else if (o && typeof o === "object") {
//       return Object.fromEntries(
//         Object.entries(o).map(([k, v]) => [k, traverse(v, [...path, k])])
//       );
//     }
//     return o;
//   }
//   return traverse(obj);
// }

// async function translateMiddleware(req, res, next) {
//   const originalJson = res.json;
//   const lang = req.headers["accept-language"];

//   if (!["hi", "en"].includes(lang)) return next();

//   res.json = async function (data) {
//     try {
//       const { texts, paths } = extractStrings(data);
//       if (texts.length === 0) return originalJson.call(this, data);

//       const translated = await batchTranslate(texts, lang);
//       const newData = replaceStrings(data, translated, paths);

//       return originalJson.call(this, newData);
//     } catch (err) {
//       console.error("Translation Middleware Error:", err);
//       try {
//         originalJson.call(this, data);
//       } catch (fallbackError) {
//         console.error("Fallback Response Error:", fallbackError);
//         res.status(500).send({ error: "Translation failed" });
//       }
//     }
//   };

//   next();
// }

// module.exports = translateMiddleware;





require("dotenv").config();
const AWS = require("aws-sdk");
const { LRUCache } = require("lru-cache");
const Bottleneck = require("bottleneck");

// Configure AWS Translate
const translate = new AWS.Translate({ region: process.env.AWS_DEFAULT_REGION });

// Bottleneck limiter — adjust minTime to fit AWS Translate rate limits
const limiter = new Bottleneck({
  maxConcurrent: 5,
  minTime: 200, // ~5 requests/sec 
});

// 1. Phrase masking
const PHRASES_TO_STANDARDIZE = [
  { variants: ["हिंद सेना", "हिन्द सेना"], replacement: "Hind Sena" },
];

function maskPhrases(text, targetLang) {
  if (targetLang !== "en") return text;
  let masked = text;
  for (const { variants, replacement } of PHRASES_TO_STANDARDIZE) {
    for (const variant of variants) {
      masked = masked.replaceAll(variant, replacement);
    }
  }
  return masked;
}

function unmaskPhrases(text) {
  return text; 
}

// 2. LRU Cache
const translationCache = new LRUCache({
  max: 1000,
  ttl: 1000 * 60 * 60 * 12,
});

// 3. Helpers
function detectLanguage(text) {
  return /[\u0900-\u097F]/.test(text) ? "hi" : "en";
}
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// 4. Limited concurrency
async function limitedBatch(items, limit, asyncFn) {
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await asyncFn(items[i]);
    }
  }
  await Promise.all(
    Array(limit)
      .fill()
      .map(() => worker())
  );
  return results;
}

// 5. Split long text
function splitLongText(text, maxBytes) {
  const parts = [];
  let current = "",
    currentSize = 0;
  const sentences = text.split(/(?<=[।.!?])\s+/);
  for (const sentence of sentences) {
    const size = Buffer.byteLength(sentence, "utf-8");
    if (currentSize + size > maxBytes) {
      if (current.trim()) parts.push(current.trim());
      current = sentence;
      currentSize = size;
    } else {
      current += (current ? " " : "") + sentence;
      currentSize += size;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

// 6. Create safe batches
function createBatches(texts, maxBatchBytes = 9500) {
  const batches = [];
  let batch = [],
    batchSize = 0;
  for (const text of texts) {
    const textSize = Buffer.byteLength(text, "utf-8");
    const sepSize = batch.length ? Buffer.byteLength("\n----\n", "utf-8") : 0;

    if (textSize > maxBatchBytes) {
      for (const part of splitLongText(text, maxBatchBytes)) {
        const partSize = Buffer.byteLength(part, "utf-8");
        if (batchSize + partSize + sepSize > maxBatchBytes) {
          batches.push(batch);
          batch = [part];
          batchSize = partSize;
        } else {
          batch.push(part);
          batchSize += partSize + sepSize;
        }
      }
    } else if (batchSize + textSize + sepSize > maxBatchBytes) {
      batches.push(batch);
      batch = [text];
      batchSize = textSize;
    } else {
      batch.push(text);
      batchSize += textSize + sepSize;
    }
  }

  if (batch.length) batches.push(batch);
  return batches;
}

// 7. Core batchTranslate function
async function batchTranslate(texts, targetLang) {
  if (!texts.length) return texts;

  const translationMap = {};
  const textsToTranslate = [];
  const maskedToOriginal = new Map();

  for (const text of [...new Set(texts)]) {
    const cacheKey = `${text}|${targetLang}`;
    if (!text.trim()) {
      translationMap[text] = text;
    } else if (translationCache.has(cacheKey)) {
      translationMap[text] = translationCache.get(cacheKey);
    } else if (detectLanguage(text) !== targetLang) {
      const masked = maskPhrases(text, targetLang);
      maskedToOriginal.set(masked, text);
      textsToTranslate.push(masked);
    } else {
      translationMap[text] = text;
    }
  }

  const batches = createBatches(textsToTranslate);

  try {
    await limitedBatch(batches, 3, async (batch) => {
      const joined = batch.join("\n----\n");
      const params = {
        Text: joined,
        SourceLanguageCode: detectLanguage(batch[0]),
        TargetLanguageCode: targetLang,
      };

      let res;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          // Use Bottleneck-wrapped call
          res = await limiter.schedule(() =>
            translate.translateText(params).promise()
          );
          break;
        } catch (err) {
          if (attempt === 2) throw err;
          await sleep(500 * (attempt + 1));
        }
      }

      const parts = res.TranslatedText.split("\n----\n");
      batch.forEach((masked, i) => {
        const original = maskedToOriginal.get(masked);
        const translated = unmaskPhrases(parts[i] || masked);
        translationMap[original] = translated;
        translationCache.set(`${original}|${targetLang}`, translated);
      });
    });
  } catch (err) {
    console.error("Translation batch failed:", err);
    return texts;
  }

  return texts.map((t) => translationMap[t] || t);
}

// 8. Middleware wiring

const EXCLUDED_FIELDS = new Set([
  "token",
  "fcmToken",
  "uri",
  "image",
  "isMember",
  "dateOfJoining",
  "isSocialLogin",
  "createDate",
  "updatedDate",
]);

function extractStrings(obj) {
  const texts = [],
    paths = [];
  (function trav(o, path = []) {
    if (typeof o === "string") {
      texts.push(o);
      paths.push(path);
    } else if (Array.isArray(o)) {
      o.forEach((v, i) => trav(v, [...path, i]));
    } else if (o && typeof o === "object") {
      for (const [k, v] of Object.entries(o)) {
        if (!EXCLUDED_FIELDS.has(k)) trav(v, [...path, k]);
      }
    }
  })(obj);
  return { texts, paths };
}

function replaceStrings(obj, newTexts, paths) {
  let idx = 0;
  return (function trav(o, path = []) {
    if (
      idx < paths.length &&
      JSON.stringify(path) === JSON.stringify(paths[idx])
    ) {
      return newTexts[idx++];
    } else if (Array.isArray(o)) {
      return o.map((v, i) => trav(v, [...path, i]));
    } else if (o && typeof o === "object") {
      return Object.fromEntries(
        Object.entries(o).map(([k, v]) => [k, trav(v, [...path, k])])
      );
    }
    return o;
  })(obj);
}

async function translateMiddleware(req, res, next) {
  const originalJson = res.json;
  const lang = req.headers["accept-language"];
  if (!["hi", "en"].includes(lang)) return next();

  res.json = async (data) => {
    try {
      const { texts, paths } = extractStrings(data);
      if (!texts.length) return originalJson.call(res, data);

      const translated = await batchTranslate(texts, lang);
      const newData = replaceStrings(data, translated, paths);
      return originalJson.call(res, newData);
    } catch (e) {
      console.error("Translation Middleware Error:", e);
      return originalJson.call(res, data);
    }
  };

  next();
}

module.exports = translateMiddleware;