import { cardioOptions, martialArtsOptions, strengthVariants } from "@/config/fitness";
import { journalEntryTypes } from "@/domain/journal";
import { checkInTypes } from "@/domain/metrics";
import { mealTypes } from "@/domain/nutrition";
import { taskDifficulties, taskPriorities, taskTags } from "@/domain/tasks";
import { goalHorizons, goalPillars } from "@/domain/goals";

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
      name: "create_goal",
      description: "Create a strategic goal that quests can support.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          pillar: { type: "string", enum: goalPillars },
          horizon: { type: "string", enum: goalHorizons },
          description: { type: "string" },
          targetDate: { type: "string", description: "ISO date YYYY-MM-DD" },
          metricName: { type: "string" },
          targetValue: num,
          currentValue: num,
          unit: { type: "string" }
        },
        required: ["title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_task",
      description: "Update an open task by its id from app context.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: taskPriorities },
          tags: { type: "array", items: { type: "string", enum: taskTags } },
          dueDate: { type: "string", description: "ISO date YYYY-MM-DD" },
          plannedForDate: { type: "string", description: "ISO date YYYY-MM-DD" },
          difficulty: { type: "string", enum: taskDifficulties }
        },
        required: ["taskId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "defer_task",
      description: "Move an open task to another planned date.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          plannedForDate: { type: "string", description: "ISO date YYYY-MM-DD" }
        },
        required: ["taskId", "plannedForDate"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "archive_task",
      description: "Archive an open task that is no longer relevant.",
      parameters: {
        type: "object",
        properties: { taskId: { type: "string" } },
        required: ["taskId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "propose_daily_plan",
      description: "Propose today's main quest, side quests, and intention using task ids from context.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "ISO date YYYY-MM-DD" },
          mainQuestTaskId: { type: "string" },
          sideQuestTaskIds: { type: "array", items: { type: "string" } },
          intention: { type: "string" },
          rationale: { type: "string" }
        },
        required: ["date", "sideQuestTaskIds", "rationale"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_journal_entry",
      description: "Capture a reflection or lesson in the journal.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "ISO date YYYY-MM-DD" },
          type: { type: "string", enum: journalEntryTypes },
          content: { type: "string" },
          prompt: { type: "string" }
        },
        required: ["date", "type", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_daily_report",
      description: "Generate and save a daily report from the app's stored data.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "ISO date YYYY-MM-DD" },
          style: { type: "string", enum: ["deterministic", "ai_assisted"] }
        },
        required: ["date", "style"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "save_memory",
      description:
        "Store or update a durable coaching fact about the user in long-term memory — injuries, medications, conditions, equipment, schedule, food likes/dislikes, what has worked, goals, preferences. Proactively use this whenever the user mentions such a fact. Re-using a key updates it.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string", description: "Short topic, e.g. 'right knee' or 'lisinopril'." },
          content: { type: "string", description: "The fact to remember." },
          category: {
            type: "string",
            enum: [
              "medication",
              "condition",
              "injury",
              "training",
              "nutrition",
              "equipment",
              "schedule",
              "preference",
              "goal",
              "general"
            ],
            description: "Bucket for the fact. Use medication/condition/injury for anything health-critical."
          }
        },
        required: ["key", "content"]
      }
    }
  }
];
