/**
 * The line at the top of the dashboard.
 *
 * Written out rather than generated. A model call to say hello would cost real
 * money on every page load, take a second to arrive, and occasionally say
 * something odd — for a line that exists to make the page feel awake, a list
 * someone wrote is better on all three counts.
 *
 * Picked on the server and passed down, because a value derived from the clock
 * during render disagrees between server and client and React logs a hydration
 * mismatch.
 */

type Band = "earlyMorning" | "morning" | "afternoon" | "evening" | "night";

/** The greeting proper — "Good morning" and its neighbours. */
const SALUTATION: Record<Band, string[]> = {
  earlyMorning: ["You're up early", "Morning, early bird", "Up before the sun"],
  morning: ["Good morning", "Morning", "Rise and shine"],
  afternoon: ["Good afternoon", "Afternoon", "Hope the day's going well"],
  evening: ["Good evening", "Evening", "Winding down?"],
  night: ["Still up?", "Late one", "Burning the midnight oil"],
};

/**
 * The second line. Deliberately light — it sits above a list of things the
 * user has not done yet, so it should not nag, and it should not pretend to
 * know more about their day than it does.
 */
const ASIDE: Record<Band, string[]> = {
  earlyMorning: [
    "The quiet hours are the productive ones.",
    "Nobody else is awake to interrupt you.",
    "First light, first task.",
    "The day hasn't had a chance to go wrong yet.",
  ],
  morning: [
    "Let's see what today looks like.",
    "Coffee first, then the list.",
    "A fresh day and a short list is a good combination.",
    "Pick one thing and start there.",
    "The list is shorter than it feels.",
    "Nothing here can't wait for your coffee.",
  ],
  afternoon: [
    "The afternoon stretch — pick the easy one.",
    "Halfway there.",
    "Still plenty of day left.",
    "Momentum's cheaper than motivation.",
    "One more before the day gets away.",
  ],
  evening: [
    "Wrapping up, or just getting started?",
    "Whatever's left will keep until tomorrow.",
    "Good time to see what tomorrow looks like.",
    "The day's mostly spent — spend the rest well.",
    "Tick one off and call it.",
  ],
  night: [
    "Anything here can wait until morning.",
    "Sleep is a productivity tool.",
    "Tomorrow's list will still be here.",
    "This will all look easier after some sleep.",
    "Whatever it is, it'll keep.",
  ],
};

/** Shown instead of the aside when there is genuinely nothing to do. */
const ALL_CLEAR = [
  "Nothing due. Enjoy it.",
  "Your list is empty. That's allowed.",
  "All clear.",
  "Nothing needs you right now.",
];

function bandFor(hour: number): Band {
  if (hour < 6) return "earlyMorning";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 22) return "evening";
  return "night";
}

/**
 * Pick from a list without repeating hour to hour.
 *
 * Seeded by the date and hour rather than randomly: two renders in the same
 * hour give the same line, so a refresh doesn't reshuffle the page, but it
 * still changes through the day.
 */
function pick<T>(items: T[], seed: number): T {
  return items[Math.abs(seed) % items.length];
}

export type Greeting = { salutation: string; aside: string };

export function greetingFor(now: Date, name: string, hasWork: boolean): Greeting {
  const band = bandFor(now.getHours());
  const seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  const hourSeed = seed * 31 + now.getHours();

  const salutation = pick(SALUTATION[band], seed);
  const aside = hasWork ? pick(ASIDE[band], hourSeed) : pick(ALL_CLEAR, hourSeed);

  return {
    salutation: name ? `${salutation}, ${name}` : salutation,
    aside,
  };
}
