// NEW: HR assessments config (sections/metrics can be extended without code changes)
export const hrAssessmentTemplate = [
  {
    id: "general",
    label: "General Performance",
    metrics: [
      { id: "quality", label: "Quality of work", scale: 5, help: "Accuracy, completeness, hygiene." },
      { id: "speed", label: "Speed / throughput", scale: 5, help: "Service speed or ticket time." },
      { id: "teamwork", label: "Teamwork", scale: 5, help: "Collaboration, helping peers." },
    ],
  },
  {
    id: "attendance",
    label: "Attendance & Reliability",
    metrics: [
      { id: "punctuality", label: "Punctuality", scale: 5 },
      { id: "reliability", label: "Reliability", scale: 5 },
    ],
  },
  {
    id: "customer",
    label: "Customer Service (FOH)",
    metrics: [
      { id: "hospitality", label: "Hospitality", scale: 5 },
      { id: "upsell", label: "Upsell / suggestive selling", scale: 5 },
    ],
  },
  {
    id: "kitchen",
    label: "Kitchen / BOH",
    metrics: [
      { id: "accuracy", label: "Recipe accuracy", scale: 5 },
      { id: "waste", label: "Waste discipline", scale: 5 },
    ],
  },
];
