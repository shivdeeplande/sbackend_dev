require('dotenv').config();
const AWS = require("aws-sdk");


// Configure AWS Translate
const translate = new AWS.Translate({ region: process.env.AWS_DEFAULT_REGION });


const translationCache = new Map(); // In-memory cache to store translations

async function batchTranslate(textArray, targetLang) {
    if (!textArray.length || targetLang === "en") return textArray; // Skip if empty or English

    // Check cache first to avoid duplicate translations
    const untranslatedTexts = [];
    const translationMap = {}; // Store already cached translations

    for (let text of textArray) {
        if (!text || text.trim() === "") {  // ✅ Skip empty values
            translationMap[text] = text;
        }
        else if (translationCache.has(text)) {
            translationMap[text] = translationCache.get(text);
        } else {
            untranslatedTexts.push(text);
        }
    }

    // Translate only texts that are not cached
    if (untranslatedTexts.length > 0) {
        try {
            const translatedResults = await Promise.all(
                untranslatedTexts.map(async (text) => {
                    const params = {
                        Text: text,
                        SourceLanguageCode: "en",
                        TargetLanguageCode: targetLang,
                    };
                    const result = await translate.translateText(params).promise();
                    translationMap[text] = result.TranslatedText;
                    translationCache.set(text, result.TranslatedText); // Store in cache
                    return result.TranslatedText;
                })
            );

            untranslatedTexts.forEach((text, index) => {
                translationMap[text] = translatedResults[index];
            });
        } catch (error) {
            console.error("Translation Error:", error);
            return textArray; // Return original text if translation fails
        }
    }

    // Return the translated array in the same order
    return textArray.map(text => translationMap[text] || text);
}

// Function to extract all string values from JSON object
function extractStrings(obj) {
    const texts = [];
    function traverse(o) {
        if (typeof o === "string") {
            texts.push(o);
        } else if (Array.isArray(o)) {
            o.forEach(traverse);
        } else if (typeof o === "object" && o !== null) {
            Object.values(o).forEach(traverse);
        }
    }
    traverse(obj);
    return texts;
}

// Function to replace translated values back into JSON object
function replaceStrings(obj, translatedTexts) {
    let index = 0;
    function traverse(o) {
        if (typeof o === "string") {
            return translatedTexts[index++];
        } else if (Array.isArray(o)) {
            return o.map(traverse);
        } else if (typeof o === "object" && o !== null) {
            return Object.fromEntries(
                Object.entries(o).map(([key, value]) => [key, traverse(value)])
            );
        }
        return o;
    }
    return traverse(obj);
}

// Middleware to dynamically translate based on query param OR header
async function translateMiddleware(req, res, next) {
    const originalJson = res.json; // Store original response function

    res.json = async function (data) {
        try {
            // Determine language: Default is English, check `query.lang` or `Accept-Language` header
            const langQuery = req.query.lang;
            const langHeader = (req.headers["lang"] || req.headers["accept-language"] || "en").toLowerCase();
            const targetLang = langQuery ? langQuery.toLowerCase() : langHeader;

            if (targetLang === "en") {
                return originalJson.call(this, data); // If English, send original data
            }

            const textArray = extractStrings(data); // Extract all text values
            const translatedTexts = await batchTranslate(textArray, targetLang); // Batch translate
            const translatedData = replaceStrings(data, translatedTexts); // Replace in original structure

            originalJson.call(this, translatedData);
        } catch (error) {
            console.error("Middleware Translation Error:", error);
            originalJson.call(this, data); // Fallback if error occurs
        }
    };

    next();
}

module.exports = translateMiddleware;



