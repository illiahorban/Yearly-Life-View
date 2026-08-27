// ─── Calendar & Life App Domain Types ─────────────────────────────────────────

export type Lang = "en" | "ru";

export type TimestampFields = {
  createdAt?: number;
  updatedAt?: number;
};

export type AppleColorKey =
  | "blue"
  | "green"
  | "indigo"
  | "orange"
  | "pink"
  | "purple"
  | "red"
  | "teal"
  | "yellow"
  | "mint"
  | "brown"
  | "black"
  | "grey"
  | "white";

export type QuarterMeta = {
  name: string;
  colorKey: AppleColorKey;
};

export type QuarterMetaForSync = {
  name?: string;
  color?: string;
}[];

export type Quarter = {
  key: AppleColorKey;
  label: string;
  tint: string;
  darkTint: string;
  border: string;
  fill: string;
  tileFill: string;
  text: string;
  nameColor: string;
  soft: string;
  darkSoft: string;
};

export type Block = {
  id: string;
  weeks: number;
  label: string;
  color?: AppleColorKey;
};

export type QuarterConfig = {
  blocks: Block[];
};

export type CalendarConfig = {
  quarters: QuarterConfig[];
} & TimestampFields;

export type DayState = "past" | "today" | "future" | "out";

export type Milestone = {
  id: string;
  label: string;
  date: string;
  color: string;
  description?: string;
  recurring?: boolean;
} & TimestampFields & {
    isDeleted?: boolean;
  };

export type Goal = {
  id: string;
  text: string;
  done: boolean;
  color?: string;
  isDeleted?: boolean;
} & TimestampFields;

export type BlockGoals = {
  description: string;
  goals: Goal[];
  isDeleted?: boolean;
} & TimestampFields;

export type DayGoals = {
  count: number;
  done: boolean[];
  labels?: string[];
  colors?: (string | undefined)[];
  isDeleted?: boolean;
} & TimestampFields;

export type NoteEntry = {
  id: string;
  text: string;
  createdAt?: number;
  color?: string;
  isDeleted?: boolean;
} & TimestampFields;

export type DayTemplate = {
  id: string;
  name: string;
  items: string[];
} & TimestampFields & {
    isDeleted?: boolean;
  };

export type LifeSettings = {
  birthDate: string;
  lifespan: number;
} & TimestampFields;

export type LifeView = "years" | "months" | "weeks" | "days";

export type AchromaticStyle = {
  bg: string;
  border: string;
  text: string;
  marker: string;
  markerBorder?: string;
  ring?: string;
  tier: "black" | "grey" | "white";
};

export type GoalCheckboxStyle = {
  bg: string;
  border: string;
  icon: string;
};

export type LangCtx = {
  t: (k: string) => string;
  months: string[];
  weekdays: string[];
  lang: Lang;
};
