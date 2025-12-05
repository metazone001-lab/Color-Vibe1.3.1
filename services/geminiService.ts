import { GoogleGenAI, Type } from "@google/genai";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API Key not found");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const generatePartyPalette = async (eventName: string): Promise<string[]> => {
  const ai = getClient();
  if (!ai) return ['#FF0000', '#00FF00', '#0000FF']; // Fallback

  try {
    const modelId = 'gemini-2.5-flash';
    // Translated prompt for better context with Portuguese event names
    const prompt = `Gere uma lista de 5 códigos de cor hexadecimais que combinem com a vibe de uma festa chamada "${eventName}". As cores devem ser vibrantes e adequadas para um show de luzes (light show).`;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            colors: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Lista de códigos hexadecimais de cores",
            },
          },
          required: ["colors"],
        },
      },
    });

    const result = JSON.parse(response.text || '{"colors": []}');
    return result.colors || ['#FFFFFF'];
  } catch (error) {
    console.error("Error generating palette:", error);
    return ['#FF0055', '#0055FF', '#55FF00', '#FFFF00', '#FF00FF']; // Fallback vivid colors
  }
};