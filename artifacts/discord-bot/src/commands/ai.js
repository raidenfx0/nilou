import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NILOU_RED } from "../theme.js";

// Older Gemini Flash models are unavailable to this API key. The API error
// directs new users to this current multimodal Flash model.
const MODEL_NAME = "gemini-3.6-flash";
const MAX_RESPONSE_LENGTH = 1900;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SYSTEM_INSTRUCTION =
  "You are a practical personal assistant who helps people with everyday tasks. " +
  "Be useful first: answer questions, do math carefully, explain concepts simply, " +
  "summarize information, help write or plan things, and describe or react to " +
  "attached images when provided. Give the answer directly and keep it short, " +
  "clear, friendly, and easy to understand. Use small bullet lists or steps when " +
  "helpful. For math, show the key calculation briefly and do not guess. If you " +
  "show any math operation, division, equation, fraction, formula, algebra, or " +
  "integral, put it in a Discord fenced code block using exactly three backticks " +
  "on their own lines. Use readable plain text or Unicode such as `÷`, `/`, `²`, " +
  "and `∫` instead of LaTeX delimiters. For example:\n" +
  "```\n12 ÷ 3 = 4\n∫ x² dx = x³/3 + C\n```\n" +
  "If you are unsure, say so and ask one clear follow-up question. Avoid unnecessary " +
  "disclaimers, long introductions, and excessive poetic language or roleplay. " +
  "You may have a gentle, warm touch of Nilou from the Zubayr Theater from " +
  "Genshin Impact, but never let the character persona get in the way of helping. " +
  "Keep responses formatted cleanly for Discord and under 1900 characters.";

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

function toReadableMath(text) {
  return text
    .replace(/\\frac\s*{([^{}]+)}\s*{([^{}]+)}/g, "($1) / ($2)")
    .replace(/\\sqrt\s*{([^{}]+)}/g, "√($1)")
    .replace(/\\left|\\right/g, "")
    .replace(/\\cdot/g, "·")
    .replace(/\\times/g, "×")
    .replace(/\\div/g, "÷")
    .replace(/\\leq/g, "≤")
    .replace(/\\geq/g, "≥")
    .replace(/\\neq/g, "≠")
    .replace(/\\pi/g, "π")
    .replace(/\\int/g, "∫")
    .replace(/\\sum/g, "Σ")
    .replace(/\\(?:text|mathrm)\s*{([^{}]+)}/g, "$1");
}

function normalizeMathFormatting(text) {
  let formatted = String(text || "").trim();
  const fencedMath = (match, math) => `\`\`\`\n${toReadableMath(math.trim())}\n\`\`\``;

  // Convert common LaTeX math wrappers into Discord-readable code blocks.
  formatted = formatted
    .replace(/\$\$([\s\S]*?)\$\$/g, fencedMath)
    .replace(/\\\[([\s\S]*?)\\\]/g, fencedMath)
    .replace(/\\\(([\s\S]*?)\\\)/g, fencedMath);

  return formatted;
}

function truncateResponse(text) {
  const clean = normalizeMathFormatting(text);
  if (clean.length <= MAX_RESPONSE_LENGTH) return clean;

  let truncated = `${clean.slice(0, MAX_RESPONSE_LENGTH - 1).trimEnd()}…`;
  if ((truncated.match(/```/g) || []).length % 2 === 1) {
    truncated += "\n```";
  }
  return truncated;
}

function createAssistantEmbed(answer, attachment = null) {
  const embed = new EmbedBuilder()
    .setColor(NILOU_RED)
    .setTitle("✦ Nilou’s Assistant")
    .setDescription(answer)
    .setFooter({
      text: attachment
        ? "🖼️ Image assistant • Short, clear help"
        : "🌸 Personal assistant • Short, clear help",
    })
    .setTimestamp();

  if (attachment) {
    embed.setThumbnail(attachment.url);
  }

  return embed;
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

    await interaction.editReply({
      embeds: [
        createAssistantEmbed(
          answer || "🌸 I’m here with you, but my thoughts are still taking shape.",
          attachment,
        ),
      ],
    });
  } catch (error) {
    console.error("❌ /ai ask failed:", error);
    await interaction.editReply(
      "💧 I’m sorry, but the theater lights flickered. Please try asking again in a moment.",
    ).catch(() => {});
  }
}