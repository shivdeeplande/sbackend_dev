// require('dotenv').config();
// const AWS = require("aws-sdk");

// // Configure AWS Translate
// const translate = new AWS.Translate({ region: process.env.AWS_DEFAULT_REGION });

// // Fields that should NOT be translated
// const EXCLUDED_FIELDS = new Set([
//     "token",
//     "fcmToken",
//     "uri",
//     "image",
//     "createDate",
//     "updatedDate"
// ]);

// const translationCache = new Map(); // In-memory cache to store translations

// // Detect if text is in Hindi or English
// function detectLanguage(text) {
//     return /[\u0900-\u097F]/.test(text) ? "hi" : "en";
// }

// // Function to translate multiple texts efficiently using Promise.all
// async function batchTranslate(textArray, targetLang) {
//     if (!textArray.length) return textArray; // Skip if empty array

//     const uniqueTexts = [...new Set(textArray)]; // Remove duplicates
//     const translationMap = {}; // Store translations
//     const textsToTranslate = [];

//     for (const text of uniqueTexts) {
//         if (!text.trim()) {
//             translationMap[text] = text; // Skip empty strings
//         } else if (translationCache.has(text + targetLang)) {
//             translationMap[text] = translationCache.get(text + targetLang);
//         } else if (detectLanguage(text) !== targetLang) {
//             textsToTranslate.push(text);
//         } else {
//             translationMap[text] = text; // Already correct language
//         }
//     }

//     if (textsToTranslate.length > 0) {
//         try {
//             const translationPromises = textsToTranslate.map(async (text) => {
//                 const params = {
//                     Text: text,
//                     SourceLanguageCode: detectLanguage(text),
//                     TargetLanguageCode: targetLang
//                 };
//                 const result = await translate.translateText(params).promise();
//                 translationMap[text] = result.TranslatedText;
//                 translationCache.set(text + targetLang, result.TranslatedText);
//                 return result.TranslatedText;
//             });

//             const translatedResults = await Promise.all(translationPromises);

//             textsToTranslate.forEach((text, index) => {
//                 translationMap[text] = translatedResults[index];
//             });
//         } catch (error) {
//             console.error("Translation Error:", error);
//             return textArray; // Return original if translation fails
//         }
//     }

//     return textArray.map(text => translationMap[text] || text);
// }

// // Extract text fields from JSON while preserving structure
// function extractStrings(obj) {
//     const texts = [];
//     const paths = [];

//     function traverse(o, path = []) {
//         if (typeof o === "string") {
//             texts.push(o);
//             paths.push([...path]);
//         } else if (Array.isArray(o)) {
//             o.forEach((item, index) => traverse(item, [...path, index]));
//         } else if (typeof o === "object" && o !== null) {
//             Object.entries(o).forEach(([key, value]) => {
//                 if (!EXCLUDED_FIELDS.has(key)) traverse(value, [...path, key]);
//             });
//         }
//     }

//     traverse(obj);
//     return { texts, paths };
// }

// // Replace translated text back into JSON
// function replaceStrings(obj, translatedTexts, paths) {
//     let index = 0;
//     function traverse(o, path = []) {
//         if (paths.length > index && JSON.stringify(path) === JSON.stringify(paths[index])) {
//             return translatedTexts[index++];
//         } else if (Array.isArray(o)) {
//             return o.map((item, idx) => traverse(item, [...path, idx]));
//         } else if (typeof o === "object" && o !== null) {
//             return Object.fromEntries(
//                 Object.entries(o).map(([key, value]) => [key, traverse(value, [...path, key])])
//             );
//         }
//         return o;
//     }
//     return traverse(obj);
// }

// // Middleware to translate dynamically
// async function translateMiddleware(req, res, next) {
//     const originalJson = res.json;

//     res.json = async function (data) {
//         try {
//             const targetLang = req.headers["accept-language"] === "hi" ? "hi" : "en";

//             const { texts, paths } = extractStrings(data);
//             if (texts.length === 0) return originalJson.call(this, data);

//             const translatedTexts = await batchTranslate(texts, targetLang);
//             const translatedData = replaceStrings(data, translatedTexts, paths);

//             originalJson.call(this, translatedData);
//         } catch (error) {
//             console.error("Middleware Translation Error:", error);
//             originalJson.call(this, data);
//         }
//     };

//     next();
// }

// module.exports = translateMiddleware;



require('dotenv').config();
const AWS = require("aws-sdk");

// Configure AWS Translate
const translate = new AWS.Translate({ region: process.env.AWS_DEFAULT_REGION });

// Fields that should NOT be translated
const EXCLUDED_FIELDS = new Set([
    "token",
    "fcmToken",
    "uri",
    "image",
    "isMember",
    "createDate",
    "updatedDate"
]);

const translationCache = new Map(); // In-memory cache for translations

// Function to detect language without translating
function detectLanguage(text) {
    return /[\u0900-\u097F]/.test(text) ? "hi" : "en";
}

// Function to translate text (if needed)
async function batchTranslate(textArray, targetLang) {
    if (!textArray.length) return textArray; // Skip if empty array

    const uniqueTexts = [...new Set(textArray)]; // Remove duplicates
    const translationMap = {}; // Store translations
    const textsToTranslate = [];

    for (const text of uniqueTexts) {
        if (!text.trim()) {
            translationMap[text] = text; // Skip empty strings
        } else if (translationCache.has(text + targetLang)) {
            translationMap[text] = translationCache.get(text + targetLang);
        } else if (detectLanguage(text) !== targetLang) {
            textsToTranslate.push(text);
        } else {
            translationMap[text] = text; // Already correct language
        }
    }

    if (textsToTranslate.length > 0) {
        try {
            const translationPromises = textsToTranslate.map(async (text) => {
                const params = {
                    Text: text,
                    SourceLanguageCode: detectLanguage(text),
                    TargetLanguageCode: targetLang
                };
                const result = await translate.translateText(params).promise();
                translationMap[text] = result.TranslatedText;
                translationCache.set(text + targetLang, result.TranslatedText);
                return result.TranslatedText;
            });

            const translatedResults = await Promise.all(translationPromises);

            textsToTranslate.forEach((text, index) => {
                translationMap[text] = translatedResults[index];
            });
        } catch (error) {
            console.error("Translation Error:", error);
            return textArray; // Return original if translation fails
        }
    }

    return textArray.map(text => translationMap[text] || text);
}

// Extract text fields from JSON while preserving structure
function extractStrings(obj) {
    const texts = [];
    const paths = [];

    function traverse(o, path = []) {
        if (typeof o === "string") {
            texts.push(o);
            paths.push([...path]);
        } else if (Array.isArray(o)) {
            o.forEach((item, index) => traverse(item, [...path, index]));
        } else if (typeof o === "object" && o !== null) {
            Object.entries(o).forEach(([key, value]) => {
                if (!EXCLUDED_FIELDS.has(key)) traverse(value, [...path, key]);
            });
        }
    }

    traverse(obj);
    return { texts, paths };
}

// Replace translated text back into JSON
function replaceStrings(obj, translatedTexts, paths) {
    let index = 0;
    function traverse(o, path = []) {
        if (paths.length > index && JSON.stringify(path) === JSON.stringify(paths[index])) {
            return translatedTexts[index++];
        } else if (Array.isArray(o)) {
            return o.map((item, idx) => traverse(item, [...path, idx]));
        } else if (typeof o === "object" && o !== null) {
            return Object.fromEntries(
                Object.entries(o).map(([key, value]) => [key, traverse(value, [...path, key])])
            );
        }
        return o;
    }
    return traverse(obj);
}

// Middleware to detect language but NOT translate during creation
async function translateMiddleware(req, res, next) {
    const originalJson = res.json;
    const languageHeader = req.headers["accept-language"];

    // 🔹 If language is NOT `hi` or `en`, just continue without translation
    if (!["hi", "en"].includes(languageHeader)) {
        return next();
    }

    res.json = async function (data) {
        try {
            const targetLang = languageHeader; // Accept-Language header defines the language

            const { texts, paths } = extractStrings(data);
            if (texts.length === 0) return originalJson.call(this, data);

            const translatedTexts = await batchTranslate(texts, targetLang);
            const translatedData = replaceStrings(data, translatedTexts, paths);

            originalJson.call(this, translatedData);
        } catch (error) {
            console.error("Middleware Translation Error:", error);
            originalJson.call(this, data);
        }
    };

    next();
}

module.exports = translateMiddleware;








