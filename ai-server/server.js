import express from "express";
import { config } from "dotenv";
import OpenAI from "openai";

config();

const prompt = `
Korrigiere folgenden Text nach Fehlern. Gib das Resultat in einem Codefenster wieder und füge am Ende jeder Zeile einen Zeilenumbruch hinzu.

Setzte folgende Formatierung ein:
- alle mehrfachen Leerzeichen löschen
- nach der Menü Nummer ein Tabulator Zeichen,
- zwischen Menü Name und Allergen ein Leerzeichen
- formatiere die Allergen Hinweise in Superscript separiert mit einem Komma 
- füge Tabulatoren zwischen den Preisen
- füge ein Zeilenumbruch nach der letzen Zeile

Hier ist ein Beispiel:

Hühnerfleischgerichte mit verschiedenem Gemüse:
21.	Sojasoße und Chilli 1,3,6,11	9,00€	12,00€
22.	Sojasoße und Chilli 1,3,6,11	9,00€	12,00€

Hier ist der zu bearbeitende Text: `;

const app = express();
const port = 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(express.json());

app.post("/correct-text", async (req, res) => {
  console.log(req.body);
  try {
    const { text } = req.body;
    const chatCompletion = await openai.chat.completions.create({
      messages: [
        {
          role: "user",
          content: `${prompt} ${text}`,
        },
      ],
      model: "gpt-4o",
    });
    res.json({ correctedText: chatCompletion.choices[0].message.content });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error processing the request");
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
