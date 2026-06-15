import type { Equipment } from "@/domain";

/**
 * The user's fixed daily training structure: one strength session (one of five
 * split days), one cardio session, and one martial-arts session. Strength
 * exercises carry per-variant form instructions + a form-video link, mirroring
 * the user's June training plan.
 */

export type StrengthVariant = "Free Weight" | "Machine" | "Kettlebell";
export const strengthVariants: StrengthVariant[] = ["Free Weight", "Machine", "Kettlebell"];

export type ExerciseVariant = {
  variant: StrengthVariant;
  name: string;
  instructions: string;
  video: string;
};

export type StrengthExercise = {
  name: string;
  scheme: string;
  variants: ExerciseVariant[];
};

export type StrengthWorkout = {
  id: string;
  day: number;
  name: string;
  exercises: StrengthExercise[];
};

const yt = (query: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

type V = [name: string, instructions: string, query: string];

function ex(name: string, scheme: string, fw: V, machine: V, kb: V): StrengthExercise {
  return {
    name,
    scheme,
    variants: [
      { variant: "Free Weight", name: fw[0], instructions: fw[1], video: yt(fw[2]) },
      { variant: "Machine", name: machine[0], instructions: machine[1], video: yt(machine[2]) },
      { variant: "Kettlebell", name: kb[0], instructions: kb[1], video: yt(kb[2]) }
    ]
  };
}

export const strengthWorkouts: StrengthWorkout[] = [
  {
    id: "day-1",
    day: 1,
    name: "Chest & Biceps",
    exercises: [
      ex(
        "Flat Chest Press",
        "4 × 8–10",
        [
          "Flat Dumbbell Bench Press",
          "Lie flat, dumbbells at chest with wrists over elbows. Press to near lockout, lower slowly to just below chest. Keep shoulder blades pinched.",
          "flat dumbbell bench press proper form"
        ],
        [
          "Chest Press Machine",
          "Seat set so handles are at mid-chest. Press straight out without hard lockout, control the return.",
          "chest press machine proper form"
        ],
        [
          "Kettlebell Floor Press",
          "On the floor, knees bent, bells at chest. Press straight up, let upper arm lightly touch the floor on the way down.",
          "kettlebell floor press form"
        ]
      ),
      ex(
        "Incline Chest Press",
        "3 × 10–12",
        [
          "Incline Dumbbell Press",
          "Bench at 30–45°. Press up and slightly together, lower to upper-chest level.",
          "incline dumbbell press proper form"
        ],
        [
          "Incline / Smith Incline Press",
          "Incline seat, press up and slightly forward, control down.",
          "incline chest press machine form"
        ],
        [
          "Incline Kettlebell Press",
          "Bench at 30–45°, bells racked on forearms at shoulders. Press overhead, control down.",
          "incline kettlebell press form"
        ]
      ),
      ex(
        "Chest Fly",
        "3 × 12–15",
        [
          "Dumbbell Flat Fly",
          "Flat bench, slight fixed elbow bend, open arms wide in an arc to a chest stretch, squeeze back together. Light–moderate weight.",
          "dumbbell chest fly proper form"
        ],
        [
          "Pec Deck",
          "Handles at shoulder height, press pads together with the chest, slow return.",
          "pec deck machine proper form"
        ],
        [
          "Kettlebell Floor Fly",
          "On the floor, soft elbows, open bells to the sides until upper arms touch the floor, squeeze up.",
          "kettlebell floor fly form"
        ]
      ),
      ex(
        "Biceps Curl",
        "3 × 10–12",
        [
          "Dumbbell Curl",
          "Stand tall, elbows pinned to sides, curl without swinging, lower slowly.",
          "dumbbell bicep curl proper form"
        ],
        [
          "Cable / Machine Preacher Curl",
          "Arms supported, curl through full range, control the negative.",
          "machine preacher curl form"
        ],
        [
          "Kettlebell Curl",
          "Hold by the handle or two hands, curl with elbows fixed; offset weight adds forearm work.",
          "kettlebell bicep curl form"
        ]
      ),
      ex(
        "Hammer Curl",
        "3 × 10–12",
        [
          "Dumbbell Hammer Curl",
          "Neutral grip (palms facing), curl keeping wrists straight. Hits brachialis/forearms.",
          "dumbbell hammer curl form"
        ],
        [
          "Cable Rope Hammer Curl",
          "Rope on a low pulley, neutral grip, curl and squeeze.",
          "cable rope hammer curl form"
        ],
        [
          "Kettlebell Hammer Curl",
          "Grip the handle with a neutral wrist, curl with control.",
          "kettlebell hammer curl form"
        ]
      )
    ]
  },
  {
    id: "day-2",
    day: 2,
    name: "Back & Shoulders",
    exercises: [
      ex(
        "Hip Hinge / Deadlift",
        "4 × 6–8",
        [
          "Dumbbell Romanian Deadlift",
          "Dumbbells at thighs, soft knees, push hips back, lower down the legs with a flat back, drive hips forward to stand.",
          "dumbbell romanian deadlift form"
        ],
        [
          "45° Back Extension",
          "Pad at hip crease, lower under control, raise to a straight line — don't hyperextend.",
          "45 degree back extension proper form"
        ],
        [
          "Kettlebell Deadlift",
          "Bell between feet, hinge at hips, flat back, stand by squeezing glutes.",
          "kettlebell deadlift form"
        ]
      ),
      ex(
        "Vertical Pull (Lats)",
        "4 × 10–12",
        [
          "Dumbbell Pullover",
          "Lie on the bench, one dumbbell over chest, lower behind the head with soft elbows, pull back over the chest using the lats.",
          "dumbbell pullover proper form"
        ],
        [
          "Lat Pulldown",
          "Wide grip, pull bar to upper chest, lead with elbows, control up.",
          "lat pulldown proper form"
        ],
        [
          "Kettlebell Pullover",
          "Same as the dumbbell version, holding the bell by the horns.",
          "kettlebell pullover form"
        ]
      ),
      ex(
        "Horizontal Row",
        "3 × 10–12",
        [
          "One-Arm Dumbbell Row",
          "Hand & knee on bench, flat back, row to the hip, squeeze the shoulder blade.",
          "one arm dumbbell row proper form"
        ],
        [
          "Seated Cable / Machine Row",
          "Chest tall, pull to the stomach, squeeze shoulder blades, control out.",
          "seated cable row proper form"
        ],
        [
          "Kettlebell Bent-Over Row",
          "Hinge with flat back, row the bell(s) to the hip.",
          "kettlebell bent over row form"
        ]
      ),
      ex(
        "Shoulder Press",
        "3 × 8–10",
        [
          "Seated Dumbbell Shoulder Press",
          "Bench upright, dumbbells at ear height, press overhead without hard lockout, lower controlled.",
          "seated dumbbell shoulder press form"
        ],
        [
          "Shoulder Press Machine",
          "Handles at shoulder height, press up, control down.",
          "shoulder press machine proper form"
        ],
        [
          "Kettlebell Overhead Press",
          "Bell racked on the forearm at the shoulder, press straight overhead, core tight.",
          "kettlebell overhead press form"
        ]
      ),
      ex(
        "Lateral Raise",
        "3 × 12–15",
        [
          "Dumbbell Lateral Raise",
          "Slight elbow bend, raise to shoulder height leading with elbows, lower slowly.",
          "dumbbell lateral raise proper form"
        ],
        [
          "Cable / Machine Lateral Raise",
          "Cable or pads at your side, raise to shoulder height, control down.",
          "cable lateral raise form"
        ],
        [
          "Kettlebell Lateral Raise",
          "Lighter bells, raise out to the sides; offset load adds tension.",
          "kettlebell lateral raise form"
        ]
      )
    ]
  },
  {
    id: "day-3",
    day: 3,
    name: "Legs & Core",
    exercises: [
      ex(
        "Squat",
        "4 × 8–10",
        [
          "Dumbbell Goblet Squat",
          "Hold one dumbbell vertically at the chest, sit down between the hips, knees over toes, drive up through mid-foot.",
          "dumbbell goblet squat form"
        ],
        [
          "Leg Press",
          "Feet shoulder-width, lower until knees ~90°, press without hard knee lockout.",
          "leg press proper form"
        ],
        [
          "Kettlebell Goblet Squat",
          "Hold the bell by the horns at the chest, squat deep and controlled.",
          "kettlebell goblet squat form"
        ]
      ),
      ex(
        "Hamstring / Hinge",
        "3 × 10–12",
        [
          "Dumbbell Romanian Deadlift",
          "Soft knees, hinge hips back, lower down the shins, feel the stretch, stand by squeezing glutes.",
          "dumbbell romanian deadlift form"
        ],
        [
          "Lying / Seated Leg Curl",
          "Pad on the back of the ankles, curl heels toward glutes, slow return.",
          "lying leg curl machine form"
        ],
        [
          "Kettlebell Swing",
          "Hinge and hike the bell back, snap the hips forward to float it to chest height — hips do the work.",
          "kettlebell swing proper form"
        ]
      ),
      ex(
        "Lunge / Split Squat",
        "3 × 10 / leg",
        [
          "Bulgarian Split Squat",
          "Rear foot on the bench, dumbbells at sides, lower straight down on the front leg, drive up.",
          "bulgarian split squat dumbbell form"
        ],
        [
          "Smith Lunge / Hack Squat",
          "Controlled depth, knee tracks over the foot, drive through the heel.",
          "hack squat machine proper form"
        ],
        [
          "KB Front-Rack Reverse Lunge",
          "Bell racked at the shoulder, step back into a lunge, drive back up.",
          "kettlebell front rack reverse lunge form"
        ]
      ),
      ex(
        "Calf Raise",
        "4 × 15",
        [
          "Dumbbell Standing Calf Raise",
          "Toes on a plate/step, dumbbell in hand, rise onto toes fully, lower for a deep stretch.",
          "dumbbell standing calf raise form"
        ],
        [
          "Calf / Leg-Press Calf Raise",
          "Full range, pause at the top.",
          "calf raise machine form"
        ],
        [
          "Kettlebell Calf Raise",
          "Hold a bell at your side, rise onto toes, slow negative.",
          "kettlebell calf raise form"
        ]
      ),
      ex(
        "Core",
        "3 × 15–20",
        [
          "Weighted Bench Sit-Up",
          "Sit on the bench, hold a dumbbell to the chest, curl up and lower with control.",
          "weighted sit up form"
        ],
        [
          "Cable Crunch / Ab Machine",
          "Kneel at a high pulley with rope (or use the ab machine), crunch ribs toward hips.",
          "cable crunch proper form"
        ],
        [
          "Kettlebell Russian Twist",
          "Seated, feet up, rotate the bell side to side, chest tall.",
          "kettlebell russian twist form"
        ]
      )
    ]
  },
  {
    id: "day-4",
    day: 4,
    name: "Chest & Arms",
    exercises: [
      ex(
        "Chest Press",
        "4 × 8–10",
        [
          "Flat Dumbbell Press",
          "Flat bench, press from chest to lockout, control the descent.",
          "flat dumbbell bench press proper form"
        ],
        [
          "Chest Press Machine",
          "Handles at mid-chest, press out, slow return.",
          "chest press machine proper form"
        ],
        [
          "Kettlebell Floor Press",
          "On the floor, press both bells up, light touch of the upper arm at the bottom.",
          "kettlebell floor press form"
        ]
      ),
      ex(
        "Dip / Push Movement",
        "3 × 10–15",
        [
          "Decline Push-Up (feet on bench)",
          "Feet on the bench, hands under shoulders, lower chest to the floor, press up in a straight line.",
          "decline push up feet elevated form"
        ],
        [
          "Assisted Dip Machine",
          "Set assistance, lower until upper arms are parallel, press up, slight forward lean for chest.",
          "assisted dip machine form"
        ],
        [
          "Bench Dips (bell on lap)",
          "Hands on the bench behind you, kettlebell on the thighs for resistance, lower and press.",
          "bench dips weighted form"
        ]
      ),
      ex(
        "Overhead Triceps Extension",
        "3 × 10–12",
        [
          "DB Overhead Triceps Extension",
          "Both hands on one dumbbell overhead, lower behind the head with elbows up, extend.",
          "dumbbell overhead triceps extension form"
        ],
        [
          "Cable Rope Overhead Extension",
          "Face away from a high pulley with rope, press up/forward extending the elbows.",
          "cable overhead triceps extension form"
        ],
        [
          "KB Overhead Triceps Extension",
          "Hold the bell by the horns overhead, lower behind the head, extend.",
          "kettlebell overhead triceps extension form"
        ]
      ),
      ex(
        "Triceps (Close)",
        "3 × 10–12",
        [
          "Dumbbell Skull Crusher",
          "Lie on the bench, lower dumbbells toward forehead/ears with elbows fixed, extend up.",
          "dumbbell skull crusher form"
        ],
        [
          "Cable Triceps Pushdown",
          "Bar or rope on a high pulley, elbows pinned, push to lockout, control up.",
          "cable triceps pushdown proper form"
        ],
        [
          "KB Close-Grip Floor Press",
          "On the floor, bells close together, press with elbows tucked to hit triceps.",
          "kettlebell close grip floor press form"
        ]
      ),
      ex(
        "Biceps (21s or straight)",
        "3 × 10–12",
        [
          "Dumbbell Curl 21s",
          "7 bottom-half reps, 7 top-half reps, 7 full reps = one set.",
          "bicep 21s curl form"
        ],
        [
          "Cable Curl",
          "Low pulley with a bar, elbows fixed, curl and squeeze, slow negative.",
          "cable bicep curl form"
        ],
        [
          "Kettlebell Curl",
          "Two-hand or single-arm curl, controlled tempo.",
          "kettlebell bicep curl form"
        ]
      )
    ]
  },
  {
    id: "day-5",
    day: 5,
    name: "Shoulders & Back",
    exercises: [
      ex(
        "Overhead Press",
        "4 × 8–10",
        [
          "Standing DB / Military Press",
          "Brace the core, press from shoulders to overhead, don't arch the lower back.",
          "standing dumbbell shoulder press form"
        ],
        [
          "Shoulder Press Machine",
          "Handles at shoulder height, press up, control down.",
          "shoulder press machine proper form"
        ],
        [
          "Double Kettlebell Press",
          "Bells racked at shoulders, press both overhead, tight core.",
          "double kettlebell overhead press form"
        ]
      ),
      ex(
        "Upright Row",
        "3 × 10–12",
        [
          "Dumbbell Upright Row",
          "Pull dumbbells up the front of the body to chest height, elbows leading high.",
          "dumbbell upright row form"
        ],
        [
          "Cable Upright Row",
          "Straight bar on a low pulley, pull to chest, elbows high, control down.",
          "cable upright row form"
        ],
        [
          "Kettlebell Upright Row",
          "Both hands on one bell, pull to chin height, elbows lead.",
          "kettlebell upright row form"
        ]
      ),
      ex(
        "Shrugs (Traps)",
        "3 × 12–15",
        [
          "Dumbbell Shrugs",
          "Dumbbells at sides, shrug straight up toward the ears, pause, lower slowly — no rolling.",
          "dumbbell shrugs proper form"
        ],
        [
          "Smith / Shrug Machine",
          "Bar in front, shrug straight up, squeeze, control down.",
          "smith machine shrug form"
        ],
        [
          "Kettlebell Shrugs",
          "A bell in each hand, shrug up and hold briefly.",
          "kettlebell shrug form"
        ]
      ),
      ex(
        "Rear Delts",
        "3 × 12–15",
        [
          "Incline Dumbbell Reverse Fly",
          "Chest-down on the incline bench, raise dumbbells out to the sides, squeeze the rear delts.",
          "incline dumbbell rear delt fly form"
        ],
        [
          "Reverse Pec Deck",
          "Chest on the pad, drive handles back and out, squeeze shoulder blades.",
          "reverse pec deck form"
        ],
        [
          "Bent-Over KB Rear Delt Raise",
          "Hinge forward, raise light bells out to the sides.",
          "kettlebell rear delt raise form"
        ]
      ),
      ex(
        "Lat Pull / Row",
        "3 × 10–12",
        [
          "One-Arm Dumbbell Row",
          "Hand & knee on the bench, row to the hip, squeeze the lat.",
          "one arm dumbbell row proper form"
        ],
        [
          "Lat Pulldown",
          "Pull the bar to the upper chest, elbows down and back, control up.",
          "lat pulldown proper form"
        ],
        [
          "Kettlebell Bent-Over Row",
          "Flat-back hinge, row the bell(s) to the hip.",
          "kettlebell bent over row form"
        ]
      )
    ]
  }
];

/** Resolve the chosen variant's detail for an exercise. */
export function getExerciseVariant(
  exercise: StrengthExercise,
  variant: StrengthVariant
): ExerciseVariant {
  return exercise.variants.find((v) => v.variant === variant) ?? exercise.variants[0];
}

/** Map a chosen variant to the Equipment tags stored on the workout record. */
export function equipmentForVariant(variant: StrengthVariant): Equipment[] {
  if (variant === "Kettlebell") return ["kettlebell"];
  if (variant === "Free Weight") return ["adjustable_dumbbells", "adjustable_bench"];
  return []; // Machine — no home-equipment tag
}

export type CardioOption = { id: string; label: string };
export const cardioOptions: CardioOption[] = [
  { id: "walk", label: "Walk" },
  { id: "run", label: "Run" },
  { id: "jog", label: "Jog" },
  { id: "ddr", label: "DDR" },
  { id: "bike-vest", label: "Exercise bike + weight vest" }
];

export type MartialArtsOption = { id: string; label: string };
export const martialArtsOptions: MartialArtsOption[] = [
  { id: "bas-beginner", label: "Bas Rutten Boxing — Beginner (audio)" },
  { id: "bas-advanced", label: "Bas Rutten Boxing — Advanced (audio)" },
  { id: "shidokan-kickboxing", label: "Shidokan Atlanta — Kickboxing class" },
  { id: "shidokan-karate", label: "Shidokan Atlanta — Karate class" }
];
