import { cardioOptions, martialArtsOptions, strengthVariants } from "@/config/fitness";
import { journalEntryTypes } from "@/domain/journal";
import { checkInTypes } from "@/domain/metrics";
import { mealTypes } from "@/domain/nutrition";
import { taskPriorities, taskTags } from "@/domain/tasks";

/**
 * OpenAI Chat Completions tool definitions for the AI coach. Mirrors the voice
 * agent's action layer so the coach can reliably make changes via real tool
 * calling (not fragile "return JSON in your text"). Confirmed proposals run
 * client-side through executeVoiceTool, so payloads validate leniently the same
 * way the voice agent does. Server-safe (no client imports).
 */

type ToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
};

const num = { type: "number" } as const;

export const COACH_TOOL_DEFINITIONS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "log_food",
      description:
        "Log a food or meal the user ate. Estimate calories/macros when not given. sodiumMg is in MILLIGRAMS (a label's 0.6 g = 600 mg), never grams.",
      parameters: {
        type: "object",
        properties: {
          description: { type: "string", description: "What was eaten." },
          mealType: { type: "string", enum: mealTypes },
          calories: num,
          proteinG: num,
          carbsG: num,
          fatG: num,
          fiberG: num,
          sugarG: num,
          sodiumMg: { type: "number", description: "Sodium in milligrams (mg)." }
        },
        required: ["description"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_food",
      description:
        "Update a previously logged food, matched by part of its description. Provide only the fields to change (sodiumMg in mg).",
      parameters: {
        type: "object",
        properties: {
          description: { type: "string", description: "Part of the existing food's name to match." },
          newDescription: { type: "string" },
          mealType: { type: "string", enum: mealTypes },
          calories: num,
          proteinG: num,
          carbsG: num,
          fatG: num,
          fiberG: num,
          sugarG: num,
          sodiumMg: num
        },
        required: ["description"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "remove_food",
      description: "Delete a logged food, matched by part of its description.",
      parameters: {
        type: "object",
        properties: { description: { type: "string" } },
        required: ["description"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "log_metric",
      description:
        "Log a health check-in / vitals (blood pressure, glucose, weight, sleep, energy, mood, steps). Provide only what the user mentions.",
      parameters: {
        type: "object",
        properties: {
          checkInType: { type: "string", enum: checkInTypes },
          energyLevel: { type: "number", description: "1-5" },
          moodLevel: { type: "number", description: "1-5" },
          sleepHours: num,
          steps: num,
          weightLbs: num,
          bloodPressureSystolic: num,
          bloodPressureDiastolic: num,
          bloodGlucoseMgDl: { type: "number", description: "Blood glucose in mg/dL." },
          notes: { type: "string" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "log_cardio",
      description: "Log a cardio session.",
      parameters: {
        type: "object",
        properties: {
          activity: { type: "string", enum: cardioOptions.map((o) => o.id) },
          minutes: num,
          distanceMiles: num,
          weightVestLbs: num
        },
        required: ["activity"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "log_strength",
      description: "Log a strength session for one of the five split days.",
      parameters: {
        type: "object",
        properties: {
          day: { type: "number", enum: [1, 2, 3, 4, 5] },
          variant: { type: "string", enum: strengthVariants }
        },
        required: ["day"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "log_martial_arts",
      description: "Log a martial-arts session.",
      parameters: {
        type: "object",
        properties: {
          session: { type: "string", enum: martialArtsOptions.map((o) => o.id) },
          minutes: num
        },
        required: ["session"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_quest",
      description: "Add a task/quest to the user's quest log.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          priority: { type: "string", enum: taskPriorities },
          tags: { type: "array", items: { type: "string", enum: taskTags } }
        },
        required: ["title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "complete_quest",
      description: "Mark an open quest as done, matched by part of its title.",
      parameters: {
        type: "object",
        properties: { title: { type: "string" } },
        required: ["title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_journal_entry",
      description: "Capture a journal entry or lesson.",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string" },
          type: { type: "string", enum: journalEntryTypes }
        },
        required: ["content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "save_note",
      description: "Save a quick note the user can read later.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          content: { type: "string" },
          tags: { type: "array", items: { type: "string" } }
        },
        required: ["content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "set_nutrition_goal",
      description: "Update daily nutrition targets. Provide only the fields to change.",
      parameters: {
        type: "object",
        properties: {
          calorieTarget: num,
          proteinTargetG: num,
          carbsTargetG: num,
          fatTargetG: num,
          waterTargetOz: num
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "set_health_goal",
      description:
        "Update health targets (weight goal, blood-pressure target, fasting-glucose target, sleep target). Provide only the fields to change.",
      parameters: {
        type: "object",
        properties: {
          weightTargetLbs: num,
          bpSystolicTarget: num,
          bpDiastolicTarget: num,
          fastingGlucoseTarget: num,
          sleepHoursTarget: num
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "save_memory",
      description:
        "Store or update a durable fact about the user in long-term memory (resume, preferences, conditions, anything worth remembering). Re-using a key updates it.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string" },
          content: { type: "string" }
        },
        required: ["key", "content"]
      }
    }
  }
];
