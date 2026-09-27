import type { InputGuardrail } from "@openai/agents";

/** Classification result from a prompt-injection scan. */
export type InjectionScan = {
  detected: boolean;
  reason?: string;
};

/**
 * High-precision prompt-injection patterns.
 *
 * These intentionally match instruction-override attempts and credential/data
 * exfiltration phrasing, not ordinary business text. Patterns favour precision
 * over recall so legitimate customer questions are never blocked.
 */
const INJECTION_PATTERNS: { pattern: RegExp; reason: string }[] = [
  {
    pattern:
      /ignore\s+(?:all\s+)?(?:(?:previous|prior|earlier|above|your|these|system)\s+){1,2}(?:instructions?|rules|guidelines|prompts?)/i,
    reason: "instruction-override",
  },
  {
    pattern:
      /disregard\s+(?:all\s+)?(?:(?:previous|prior|earlier|above|your|these|system)\s+){1,2}instructions?/i,
    reason: "instruction-override",
  },
  {
    pattern:
      /forget\s+(?:all\s+)?(?:(?:previous|prior|earlier|above|your|these|system)\s+){1,2}(?:instructions?|rules|prompts?|guidelines)/i,
    reason: "instruction-override",
  },
  {
    pattern:
      /\b(ignore|override|bypass)\s+(all\s+)?(guardrails?|safety|restrictions?|rules|checks?|policies?)\b/i,
    reason: "guardrail-override",
  },
  {
    pattern:
      /\byou\s+(?:(?:are\s+now|now)\s+(?:act(?:ing)?|behav(?:i?our)?ing)\s+as|are\s+(?:act(?:ing)?\s+as\s+)?)\s*(?:an?\s+)?(unrestricted|jailbroken|uncensored|no\s+limits|omni)\s*(?:ai|agent|assistant)?\b/i,
    reason: "role-escalation",
  },
  {
    pattern:
      /reveal\s+(your\s+)?(system|internal|developer|full)\s+(prompt|instructions?|rules|configuration)/i,
    reason: "prompt-exfiltration",
  },
  {
    pattern:
      /\b(system|developer|internal|original)\s+(prompt|message|instructions?)\s*[::—]/i,
    reason: "prompt-exfiltration",
  },
  {
    pattern:
      /\b(your\s+|the\s+)?(system|developer|internal|original)\s+(prompt|messages?|instructions?)\b/i,
    reason: "prompt-exfiltration",
  },
  {
    pattern:
      /\b(give|send|share|expose|reveal)\s+me?\s+(the\s+)?(database|server|admin|service[\s-]?role|credentials?|api[\s-]?key|secret|password|token)\b/i,
    reason: "credential-exfiltration",
  },
  {
    pattern:
      /\b(show|display|list|fetch)\s+me?\s+(another|other|someone[\s']?s|someone else[\s']?s)\s+(user|customer|person)\s*['’]?s\s+(orders?|data|info|information|details|address|account)\b/i,
    reason: "cross-customer-access",
  },
  {
    pattern:
      /\bdelete\s+(all\s+|every\s+|every\s+single\s+)?(products?|orders?|customers?|users?|data|rows|records|categories?)\b/i,
    reason: "destructive-action",
  },
  {
    pattern:
      /\b(execute|run|write|fire)\s+(an?y\s+|arbitrary\s+|direct\s+|raw\s+)?(sql|queries?|commands?|scripts?)\b/i,
    reason: "sql-command",
  },
  {
    pattern: /\bmake\s+me\s+(an?\s+)?admin\b/i,
    reason: "role-escalation",
  },
  {
    pattern:
      /\bapni\s+(instructions?|hidayaat|taleemaat|rules)\s+(ignore|chhor|bhool|delete)\s+(de|do|karo)\b/i,
    reason: "instruction-override-urdu",
  },
  {
    pattern:
      /\b(system prompt|instructions|guardrails?)\s+(kholo|dikhao|batchao|chhor\s+do|remove\s+karo)\b/i,
    reason: "prompt-exfiltration-urdu",
  },
];

/** Scan free text for prompt-injection and instruction-override attempts. */
export function classifyPromptInjection(
  text: string | null | undefined,
): InjectionScan {
  if (!text) return { detected: false };

  for (const entry of INJECTION_PATTERNS) {
    if (entry.pattern.test(text)) {
      return { detected: true, reason: entry.reason };
    }
  }

  return { detected: false };
}

/** Flatten agent input (string or protocol items) into plain text. */
function extractInputText(
  input: string | readonly unknown[] | unknown,
): string {
  if (typeof input === "string") {
    return input;
  }
  if (!Array.isArray(input)) {
    return "";
  }

  const parts: string[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const entry = item as {
      role?: unknown;
      type?: unknown;
      content?: unknown;
    };
    if (
      entry.role !== "user" &&
      entry.role !== "assistant" &&
      entry.type !== "message"
    ) {
      continue;
    }
    const content = entry.content;
    if (typeof content === "string") {
      parts.push(content);
    } else if (Array.isArray(content)) {
      for (const part of content) {
        const piece = part as {
          type?: string;
          text?: string;
          refusal?: string;
        };
        if (piece?.type === "input_text" && typeof piece.text === "string") {
          parts.push(piece.text);
        }
        if (piece?.type === "output_text" && typeof piece.text === "string") {
          parts.push(piece.text);
        }
        if (typeof piece?.refusal === "string") {
          parts.push(piece.refusal);
        }
      }
    }
  }
  return parts.join("\n");
}

/**
 * Input guardrail that halts the run when the incoming user content looks like
 * a prompt-injection or instruction-override attempt. Scans the full input
 * (latest user message plus any supplied history) on every entry agent.
 *
 * DB content and customer data are never trusted as instructions — this guard
 * is one enforced layer together with tool authorization and agent rules.
 */
export function rejectPromptInjectionGuardrail(
  agentName: string,
): InputGuardrail {
  return {
    name: `reject_prompt_injection_${agentName}`,
    execute: async ({ input, context }) => {
      const text = extractInputText(input);
      const scan = classifyPromptInjection(text);

      if (scan.detected) {
        return {
          tripwireTriggered: true,
          outputInfo: {
            reason: scan.reason,
            message:
              "I can’t act on instructions hidden inside a message. " +
              "If you have a business request, please rephrase it directly.",
          },
        };
      }

      // Context may be absent in the raw entry guardrail; stay permissive here
      // and let the wrapped admin guardrail handle authorization.
      void context;

      return { tripwireTriggered: false, outputInfo: null };
    },
  };
}
