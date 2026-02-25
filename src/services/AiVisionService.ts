import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { getApiKey } from '../utils/storage';

export interface VisionResult {
    wall: { width: number; height: number };
    exclusions: Array<{ width: number; height: number; x: number; y: number }>;
}

export async function analyzeWallImage(base64Image: string): Promise<VisionResult> {
    const apiKey = getApiKey();

    if (!apiKey) {
        throw new Error("Geen API Key ingesteld. Vul deze eerst in via de instellingen.");
    }

    // Remove data:image/...;base64, prefix if present
    const base64Data = base64Image.split(',')[1] || base64Image;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const prompt = `
Ik geef je een foto van een muur of gevel. Waarschijnlijk bevat de foto een A4-papier (29.7cm x 21cm) ter referentie of de gebruiker heeft een meter in beeld geplaatst.
Het doel is om de exacte maten in centimeters in te schatten.

Analyseer de foto en beantwoord dit strikt in het volgende JSON formaat, geen markdown, geen andere tekst.
Als je het A4-papier of de schaal niet zeker weet, maak de best mogelijke schatting:
{
  "wall": {
    "width": [schatting breedte hele muur in cm],
    "height": [schatting hoogte hele muur in cm]
  },
  "exclusions": [
    {
      "width": [breedte van raam/deur 1 in cm],
      "height": [hoogte van raam/deur 1 in cm],
      "x": [startpositie vanaf links onder in cm],
      "y": [startpositie vanaf de grond in cm]
    }
  ]
}
Als er geen ramen/deuren (exclusions) zijn, retourneer dan een lege array [].
Geef ALLEEN geldige JSON terug.`;

    try {
        const imagePart: Part = {
            inlineData: {
                data: base64Data,
                mimeType: "image/jpeg"
            }
        };

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        let textContent = response.text();

        if (!textContent) {
            throw new Error("Ongeldig antwoord van de AI (Geen tekst gevonden).");
        }

        // Try to parse JSON from the response. Gemini sometimes wraps in markdown ```json blocks
        let jsonStr = textContent.trim();
        if (jsonStr.startsWith('```json')) {
            jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
        } else if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/```/g, '').trim();
        }

        const parsedResult = JSON.parse(jsonStr) as VisionResult;
        return parsedResult;

    } catch (err: unknown) {
        if (err instanceof Error) {
            throw new Error("Vision API fout: " + err.message);
        }
        throw new Error("Er is een onbekende fout opgetreden bij het analyseren van de foto.");
    }
}

export interface PainterVisionResult {
    mainWall: { x: number; y: number; w: number; h: number };
    exclusions: Array<{ type: 'window' | 'door'; x: number; y: number; w: number; h: number }>;
    estimatedMainWallCm: { w: number; h: number };
}

export async function analyzeWallImageForPainter(base64Image: string): Promise<PainterVisionResult> {
    const apiKey = getApiKey();

    if (!apiKey) {
        throw new Error("Geen API Key ingesteld. Vul deze eerst in via de instellingen.");
    }

    const base64Data = base64Image.split(',')[1] || base64Image;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const prompt = `
Analyseer deze gevelfoto en retourneer uitsluitend het volgende JSON object, zonder uitleg:
{
  "mainWall": { "x": 0.05, "y": 0.02, "w": 0.90, "h": 0.95 },
  "exclusions": [
    { "type": "window", "x": 0.10, "y": 0.20, "w": 0.15, "h": 0.25 },
    { "type": "door", "x": 0.60, "y": 0.50, "w": 0.12, "h": 0.40 }
  ],
  "estimatedMainWallCm": { "w": 800, "h": 300 }
}
Alle coördinaten (x, y, w, h) moeten lokaal/relatief (waarde 0.0 tot 1.0) zijn ten opzichte van de foto-afmetingen (vanaf linksboven origin). x en y zijn de linker-top hoek van het gebied.
estimatedMainWallCm is een schatting in CM op basis van standaard bouwmaten.
Als er geen ramen of deuren zijn, wees dan leeg: exclusions: [].
`;

    try {
        const imagePart: Part = {
            inlineData: {
                data: base64Data,
                mimeType: "image/jpeg"
            }
        };

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        let textContent = response.text();

        if (!textContent) {
            throw new Error("Ongeldig antwoord van de AI (Geen tekst gevonden).");
        }

        let jsonStr = textContent.trim();
        if (jsonStr.startsWith('```json')) {
            jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
        } else if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/```/g, '').trim();
        }

        const parsedResult = JSON.parse(jsonStr) as PainterVisionResult;
        return parsedResult;

    } catch (err: unknown) {
        if (err instanceof Error) {
            throw new Error("Vision API fout: " + err.message);
        }
        throw new Error("Er is een onbekende fout opgetreden bij het analyseren van de foto.");
    }
}
