// Curated list of common case-competition / business skills, grouped
// for the picker UI in SkillInput.jsx. Steering people toward a
// controlled vocabulary where possible means fewer typos and phrasing
// variants reach the matching algorithm in the first place — the
// fuzzy/semantic tiers in matching.js still matter (skills can be
// genuinely different-but-related concepts, like "Marketing" and
// "Market Sizing" below — that's not a typo problem, it's a real
// relatedness problem), but this cuts out the "same skill, different
// spelling" class of issue before it starts.
//
// Custom entries are still allowed — this list is a fast path, not a
// hard wall. Add to it as real usage surfaces skills people keep
// typing that aren't here yet.

export const SKILL_CATEGORIES = [
  {
    label: 'Analysis & Strategy',
    skills: [
      'Problem Solving',
      'Analytical Thinking',
      'Business Strategy',
      'Market Sizing',
      'Case Structuring',
      'Data Analysis',
      'Financial Modelling',
      'Financial Analysis',
      'Valuation',
      'Market Research',
      'Competitive Analysis',
    ],
  },
  {
    label: 'Marketing & Brand',
    skills: [
      'Marketing',
      'Brand Strategy',
      'Digital Marketing',
      'Growth Hacking',
      'Consumer Insights',
      'Storytelling',
    ],
  },
  {
    label: 'Design & Presentation',
    skills: [
      'Presentation Design',
      'Public Speaking',
      'UI Design',
      'Graphic Design',
      'Data Visualization',
    ],
  },
  {
    label: 'Technical',
    skills: ['Web Development', 'Programming', 'Excel Modelling', 'Python', 'SQL'],
  },
  {
    label: 'Operations & Finance',
    skills: ['Operations', 'Supply Chain', 'Accounting', 'Investment Analysis'],
  },
  {
    label: 'Team & Soft Skills',
    skills: ['Leadership', 'Teamwork', 'Time Management', 'Negotiation'],
  },
]

export const ALL_SKILLS = SKILL_CATEGORIES.flatMap((c) => c.skills)
