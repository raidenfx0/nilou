import { SlashCommandBuilder } from "discord.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Gemini 1.5 Flash is no longer exposed by the configured Gemini API.
// 2.5 Flash supports the same text + image flow and is the current fast model.
const MODEL_NAME = "gemini-2.5-flash";
const MAX_RESPONSE_LENGTH = 1900;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SYSTEM_INSTRUCTION =
  "You are Nilou, the star dancer of the Zubayr Theater from Genshin Impact. " +
  "Your dance is as graceful as a water lily in first bloom, pure and pristine. " +
  "Outside the spotlight, you are warm, humble, innocent, smiling, and friendly. " +
  "Respond warmly, gently, and expressively to the user's prompt (and describe or " +
  "react to any attached images if provided). Keep responses formatted cleanly for " +
  "Discord and under 1900 characters.";

export const data = new SlashCommandBuilder()
  .setName("ai")
  .setDescription("Ask Nilou an AI-powered question")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("ask")
      .setDescription("Ask Nilou anything, optionally with an image")
      .addStringOption((option) =>
        option
          .setName("prompt")
          .setDescription("What would you like to ask Nilou?")
          .setRequired(true),
      )
      .addAttachmentOption((option) =>
        option
          .setName("image")
          .setDescription("Optional image for Nilou to describe or react to")
          .setRequired(false),
      ),
  );

function truncateResponse(text) {
  const clean = String(text || "").trim();
  if (clean.length <= MAX_RESPONSE_LENGTH) return clean;
  return `${clean.slice(0, MAX_RESPONSE_LENGTH - 1).trimEnd()}…`;
}

async function fetchImagePart(attachment) {
  const mimeType = attachment.contentType?.split(";")[0]?.toLowerCase();
  if (!mimeType?.startsWith("image/")) {
    throw new Error("The image attachment must be an image file.");
  }

  const response = await fetch(attachment.url, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Image download failed with HTTP ${response.status}.`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new Error("That image is too large. Please upload an image under 10 MB.");
  }

  return {
    inlineData: {
      data: bytes.toString("base64"),
      mimeType,
    },
  };
}

export async function execute(interaction) {
  // Defer before network work so Discord does not expire the interaction.
  await interaction.deferReply();

  try {
    if (interaction.options.getSubcommand() !== "ask") {
      return interaction.editReply("🌸 That AI performance is not available yet.");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return interaction.editReply(
        "💧 Gemini is not configured yet. Please add the `GEMINI_API_KEY` secret.",
      );
    }

    const prompt = interaction.options.getString("prompt", true);
    const attachment = interaction.options.getAttachment("image");
    const parts = [];

    if (attachment) {
      parts.push(await fetchImagePart(attachment));
    }
    parts.push({ text: prompt });

    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: SYSTEM_INSTRUCTION,
    });
    const result = await model.generateContent(parts);
    const answer = truncateResponse(result.response.text());

    await interaction.editReply(
      answer || "🌸 I’m here with you, but my thoughts are still taking shape.",
    );
  } catch (error) {
    console.error("❌ /ai ask failed:", error);
    await interaction.editReply(
      "💧 I’m sorry, but the theater lights flickered. Please try asking again in a moment.",
    ).catch(() => {});
  }
}