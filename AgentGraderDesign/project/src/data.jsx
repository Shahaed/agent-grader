// Seed data for the Agent Grader prototype.
// AP Lit — Rhetorical Analysis of a Speech

const SEED_ASSIGNMENT = {
  id: "asg_01",
  assignmentName: "Rhetorical Analysis: King's Letter from Birmingham Jail",
  courseName: "AP English Literature — Period 3",
  subject: "English",
  level: "ap",
  assignmentType: "Essay",
  createdAt: "2026-04-14",
  submissionCount: 3,
  promptSet: [
    {
      id: "p1",
      order: 1,
      title: "Identify the central argument",
      type: "essay",
      instructions:
        "In a focused paragraph, identify the central argument King makes about the moral responsibility to disobey unjust laws. Quote at least one passage that best crystallizes his claim, and explain how the surrounding context frames it.",
      citationExpectations:
        "At least one direct quotation with paragraph reference from the letter.",
      maxScore: 10,
    },
    {
      id: "p2",
      order: 2,
      title: "Rhetorical device analysis",
      type: "essay",
      instructions:
        "Select two rhetorical devices King employs (e.g. anaphora, allusion, metaphor, parallelism, ethos/pathos/logos appeals) and analyze how each advances his persuasive purpose for the intended audience of white moderate clergy.",
      citationExpectations:
        "Two distinct devices, each supported by at least one quotation.",
      maxScore: 15,
    },
    {
      id: "p3",
      order: 3,
      title: "Evaluate the letter's contemporary relevance",
      type: "essay",
      instructions:
        "Argue whether the rhetorical strategies that made King's letter persuasive in 1963 would function similarly for a contemporary audience. Support your position with a specific contemporary example.",
      citationExpectations:
        "Use at least one quotation from King, and reference one contemporary example.",
      maxScore: 15,
    },
  ],
  normalizedRubric: {
    rubricId: "RBR-KING-LETTER-01",
    gradingMode: "analytic",
    totalScaleMax: 40,
    notes:
      "Favor analytical depth over broad coverage. Penalize quotation-drop without analysis. Be generous with unconventional but well-supported readings.",
    hardRequirements: [
      "Minimum 400 words across responses.",
      "Direct quotations must use MLA parenthetical form.",
      "No AI-generated phrasing patterns (flag for review, do not deduct).",
    ],
    dimensions: [
      {
        id: "d1",
        name: "Argument & thesis",
        weight: 0.3,
        scaleMax: 10,
        descriptor: "Clarity and sophistication of the student's central claim.",
        scope: "global",
        promptIds: [],
        bands: [
          {
            label: "Exemplary",
            scoreRange: { min: 9, max: 10 },
            descriptor:
              "Thesis is precise, arguable, and gestures at the text's complexity. Extends beyond paraphrase.",
          },
          {
            label: "Proficient",
            scoreRange: { min: 7, max: 8 },
            descriptor:
              "Clear claim, reasonably specific, connected to the text though not yet complicated.",
          },
          {
            label: "Developing",
            scoreRange: { min: 5, max: 6 },
            descriptor:
              "Identifiable claim but generic or partially descriptive; begins to take a position.",
          },
          {
            label: "Beginning",
            scoreRange: { min: 0, max: 4 },
            descriptor:
              "Claim absent, vague, or primarily summary.",
          },
        ],
      },
      {
        id: "d2",
        name: "Use of evidence",
        weight: 0.25,
        scaleMax: 10,
        descriptor: "Selection, integration, and framing of textual evidence.",
        scope: "global",
        promptIds: [],
        bands: [
          {
            label: "Exemplary",
            scoreRange: { min: 9, max: 10 },
            descriptor:
              "Quotations are apt, well-integrated, and the surrounding context is honored. No quote-drops.",
          },
          {
            label: "Proficient",
            scoreRange: { min: 7, max: 8 },
            descriptor:
              "Relevant quotations with adequate framing; minor integration issues.",
          },
          {
            label: "Developing",
            scoreRange: { min: 5, max: 6 },
            descriptor:
              "Evidence present but loosely connected; some quote-drops or mis-framings.",
          },
          {
            label: "Beginning",
            scoreRange: { min: 0, max: 4 },
            descriptor:
              "Missing or decorative evidence; quotations not explained.",
          },
        ],
      },
      {
        id: "d3",
        name: "Rhetorical analysis",
        weight: 0.25,
        scaleMax: 10,
        descriptor: "Depth of analysis of King's rhetorical strategies.",
        scope: "prompt",
        promptIds: ["p2"],
        bands: [
          {
            label: "Exemplary",
            scoreRange: { min: 9, max: 10 },
            descriptor:
              "Names devices precisely, analyzes their effect on audience, and links to purpose.",
          },
          {
            label: "Proficient",
            scoreRange: { min: 7, max: 8 },
            descriptor:
              "Identifies devices with reasonable effect analysis. Audience awareness present.",
          },
          {
            label: "Developing",
            scoreRange: { min: 5, max: 6 },
            descriptor:
              "Identifies devices but effect analysis is thin or imprecise.",
          },
          {
            label: "Beginning",
            scoreRange: { min: 0, max: 4 },
            descriptor: "Labels devices without analyzing their function.",
          },
        ],
      },
      {
        id: "d4",
        name: "Voice & mechanics",
        weight: 0.2,
        scaleMax: 10,
        descriptor: "Prose control, syntax variety, mechanics.",
        scope: "global",
        promptIds: [],
        bands: [
          {
            label: "Exemplary",
            scoreRange: { min: 9, max: 10 },
            descriptor:
              "Controlled, flexible prose. Varied syntax. Near-clean mechanics.",
          },
          {
            label: "Proficient",
            scoreRange: { min: 7, max: 8 },
            descriptor:
              "Generally clear. Occasional clunky syntax or minor mechanics.",
          },
          {
            label: "Developing",
            scoreRange: { min: 5, max: 6 },
            descriptor:
              "Readable but uneven; mechanics intermittently interfere.",
          },
          {
            label: "Beginning",
            scoreRange: { min: 0, max: 4 },
            descriptor: "Mechanical errors or unclear syntax obstruct meaning.",
          },
        ],
      },
    ],
  },
  submissions: [
    {
      id: "sub_01",
      studentName: "Amara Okafor",
      fileName: "okafor_a_king_letter.docx",
      submittedAt: "2026-04-16",
      overallScore: 35,
      totalMax: 40,
      teacherSummary:
        "Amara produces a sophisticated analytic essay with strong command of rhetorical vocabulary. The third prompt's contemporary example (the 2024 student climate walkouts) is particularly apt — she traces King's 'tension' metaphor into a modern register without flattening its stakes. Watch for occasional over-reliance on anaphora as the single load-bearing device in prompt 2; a second device appears but is under-analyzed. Overall a strong, honors-level response.",
      studentFeedback: [
        "Your thesis in the first response is precise and genuinely arguable — the move from 'moral responsibility' to 'civic imagination' is the kind of specificity I want to see more of in your essays.",
        "You're doing the real work of rhetorical analysis in prompt 2: you don't just name anaphora, you show how its accumulation pressures the reader. Next step is to give parallelism the same treatment rather than listing it.",
        "The climate-walkout example lands because you stay inside King's terms. The letter's vocabulary of 'tension' does the analytical work for you — that's exactly how to use a secondary example.",
        "Small mechanics: semicolons before introductory phrases (you did this three times). Worth a five-minute review.",
      ],
      promptResults: [
        {
          promptId: "p1",
          score: 9,
          maxScore: 10,
          teacherSummary:
            "Thesis is precise and earns its complexity. Quotation is well-chosen from the 'direct action' passage and is explained, not decorated. One quibble: the framing sentence before the quote does narrative work that could be tightened.",
          studentFeedback: [
            "Your thesis is the strongest I've seen from you this year: you resist the easy gloss that King argues 'disobedience is sometimes okay' and push instead toward his claim about the *conditions* under which it becomes obligatory.",
            "Nice choice of quotation. The 'direct action seeks to so dramatize the issue' line is underused in most student essays and it does exactly what you need it to do here.",
            "The sentence before the quote narrates when it should frame. Try something like: 'King locates his argument not in abstract justice but in a specific civic duty — a duty he articulates as...' Then the quote lands harder.",
          ],
        },
        {
          promptId: "p2",
          score: 12,
          maxScore: 15,
          teacherSummary:
            "Anaphora analysis is strong — student shows how the repeated 'when you' structure performs exhaustion. Second device (parallelism) is named but its effect is asserted rather than demonstrated. Audience awareness (white moderate clergy) is present but the essay stops short of explaining *why* these devices would pressure that specific audience.",
          studentFeedback: [
            "Your anaphora analysis is the kind of close reading I want to see: you trace it across four clauses and you show the rhetorical work the repetition is doing. The phrase 'cumulative pressure of grief' is excellent.",
            "The parallelism paragraph is where I'd push you. You identify it correctly, but then you assert that it 'creates balance' — that's a textbook answer. Show me the specific clauses and tell me what the balance does to the clergy reading this letter in 1963.",
            "Audience is half-present. Add one sentence that names why *these* devices would move *these* readers — men who privileged order, decorum, and gradualism.",
          ],
        },
        {
          promptId: "p3",
          score: 14,
          maxScore: 15,
          teacherSummary:
            "Excellent contemporary example. The student argues that King's rhetorical grammar still functions but the distribution of its audience has changed. The essay's concession (that direct mail as a form no longer carries the weight a letter did) is sophisticated and under-used by most writers.",
          studentFeedback: [
            "Your climate-walkout example is the strongest I've graded. You stay inside King's vocabulary — 'tension,' 'creative extremism' — and you let the example do its work without editorializing.",
            "The concession about letter-form is the move that pushed this from a proficient to an exemplary response. Most students ignore form entirely. You treated it as part of the rhetorical situation.",
            "If you revise: the final sentence restates rather than lands. End on the concession, not on the restatement.",
          ],
        },
      ],
    },
    {
      id: "sub_02",
      studentName: "Dmitri Vance",
      fileName: "vance_d_king_rhetoric.pdf",
      submittedAt: "2026-04-16",
      overallScore: 27,
      totalMax: 40,
      teacherSummary:
        "Dmitri's response shows solid comprehension of King's argument and some genuine investment in the prompt, particularly in the third question. The first prompt, however, remains primarily summary — the thesis never quite takes a position. Rhetorical terminology is present but imprecise: what he calls 'metaphor' in prompt 2 is actually allusion. Flag for a one-on-one conversation before returning; the issues are recoverable in a single conference.",
      studentFeedback: [
        "The engagement with the third prompt is real — you clearly thought about this one. That's the kind of reading I want to see across all three responses.",
        "Prompt 1 is still mostly summary of what King says, not an argument about what King is doing. The difference: a thesis has a verb that only you could have chosen. 'King argues' is the weakest possible verb. 'King weaponizes,' 'King reframes,' 'King restages' — pick a verb that tells me your reading.",
        "Your 'metaphor' in prompt 2 is actually allusion (to the Hungarian freedom fighters). The distinction matters — let's spend five minutes on this in conference Thursday.",
      ],
      promptResults: [
        {
          promptId: "p1",
          score: 5,
          maxScore: 10,
          teacherSummary:
            "Response is primarily summary. A claim is present in the final sentence but arrives too late and is not earned by the preceding paragraph. Quotation is accurate but functions decoratively — student does not explain how it supports the argument because the argument itself is not yet developed.",
          studentFeedback: [
            "The first three sentences tell me what King writes. I want to know what King is *doing*. Those are different questions, and your response only answers the first one.",
            "Your final sentence — 'King therefore believes in moral responsibility' — is closer to a claim, but it's not arguable. Nobody would disagree. A thesis has to be a position someone could reasonably reject.",
            "Your quotation is accurate but unexplained. After you quote, spend two sentences showing me what that specific wording does. Not what it 'says' — what it does.",
          ],
        },
        {
          promptId: "p2",
          score: 9,
          maxScore: 15,
          teacherSummary:
            "Student correctly identifies anaphora. The second device identified as 'metaphor' is actually allusion (to Hungarian freedom fighters), which changes the analytical frame substantially. Effect analysis is thin throughout — devices are named and then asserted to be persuasive, without showing how.",
          studentFeedback: [
            "Anaphora identification is correct and the quotation is well chosen.",
            "What you're calling metaphor is actually allusion — King is referencing the 1956 Hungarian uprising. The analysis you need to do is different: allusion asks the reader to import meaning from one context into another. That's a different rhetorical move than metaphor.",
            "For both devices: don't tell me they are persuasive. Show me the mechanism. Anaphora works through accumulation. Allusion works through transfer of moral weight. Name the mechanism.",
          ],
        },
        {
          promptId: "p3",
          score: 13,
          maxScore: 15,
          teacherSummary:
            "This is by a wide margin the strongest of the three responses. The example (social media organizing after Parkland) is well-chosen and the student does the analytical work of comparing King's letter-form to a thread of posts. The analysis of speed-versus-patience in rhetorical forms is genuinely thoughtful.",
          studentFeedback: [
            "This is your best writing of the three. Whatever you did differently here, do it on the other two prompts.",
            "The Parkland example works because you don't just say 'this is similar.' You identify a specific asymmetry: King's rhetoric relies on slowness and accumulation, while social media rhetoric relies on speed and reach. That's an insight.",
            "One push: what does King's rhetoric *lose* when translated into a faster medium? You gestured at it but didn't land it. That's your revision target.",
          ],
        },
      ],
    },
    {
      id: "sub_03",
      studentName: "Priya Ramesh",
      fileName: "ramesh_p_ap_lit_essay.docx",
      submittedAt: "2026-04-16",
      overallScore: 31,
      totalMax: 40,
      teacherSummary:
        "Priya is clearly an advanced reader — her vocabulary and syntactic range are well beyond average — but this response suffers from a recurring issue I've flagged before: elegant sentences are doing the work that analysis should do. The voice and mechanics score is high for good reason, but the thinking is sometimes obscured by the prose rather than illuminated by it. Conversely, when she commits to an argument (as in the middle of prompt 2) she is one of the strongest writers in the section.",
      studentFeedback: [
        "Your prose is, as always, lovely. But I'm going to say again what I said on the last essay: don't let elegant sentences do the argument's job. A beautiful sentence can hide an unclear idea.",
        "The middle third of prompt 2 — where you analyze the cadence of King's parallel clauses — is some of the best writing I've read from an AP student. That's the register I want across all three responses.",
        "On prompt 3: the thesis is clear but hedged. 'One could argue' is a phrase I want you to retire this year. Either you're arguing it or you aren't.",
      ],
      promptResults: [
        {
          promptId: "p1",
          score: 8,
          maxScore: 10,
          teacherSummary:
            "Clear thesis, well-chosen quotation, and the analysis is adequate. The response stops short of exemplary because the thesis — while elegant — restates King's position rather than taking a position on it. Quality of prose compensates for the analytical restraint.",
          studentFeedback: [
            "Your opening sentence is the kind of craft I want in every response. But read it carefully: it tells me what King believes, not what you think King is *doing*.",
            "The quotation is well chosen and well framed. No notes here.",
            "Push: where is your position on the moral frame King offers? You summarize it beautifully. I want you to evaluate it.",
          ],
        },
        {
          promptId: "p2",
          score: 12,
          maxScore: 15,
          teacherSummary:
            "Parallelism analysis is the strongest of any response — Priya identifies the syntactic rhythm and shows how the cadence itself makes an argument. The second device (ethos appeal) is named correctly but analyzed generically.",
          studentFeedback: [
            "The parallelism paragraph is exemplary-level work. You analyze the sound of the prose as part of its argument, which is the move that separates strong rhetorical analysis from competent rhetorical analysis.",
            "Your ethos paragraph is where you fell back on generality. 'King establishes credibility through his status' is true but not what I want from you. How does he deploy credibility — what does he *spend* it on?",
            "Try: pick the single most expensive ethos move in the letter and analyze it.",
          ],
        },
        {
          promptId: "p3",
          score: 11,
          maxScore: 15,
          teacherSummary:
            "Response is well-written but hedged. Thesis uses 'one could argue,' which is a red flag throughout the essay. Contemporary example (reference to recent protest movements, unspecified) is under-developed and too abstract to do analytical work. Strong prose, thin argument.",
          studentFeedback: [
            "The 'one could argue' construction is doing damage across the response. Commit to your position.",
            "Your contemporary example needs to be specific. 'Recent protest movements' is four different arguments at once. Pick one.",
            "Once you pick one, your analysis will tighten automatically because you'll have something concrete to compare King's rhetorical moves against.",
          ],
        },
      ],
    },
  ],
};

// Empty assignment template for Create flow
const EMPTY_ASSIGNMENT_DRAFT = {
  assignmentName: "",
  courseName: "",
  subject: "",
  level: "high_school",
  assignmentType: "Essay",
  rubricFile: null,
  readingFiles: [],
};

// Level options
const LEVEL_OPTIONS = [
  { value: "high_school", label: "High school" },
  { value: "college", label: "College" },
  { value: "ap", label: "AP" },
  { value: "esl", label: "ESL" },
  { value: "custom", label: "Custom" },
];

const ASSIGNMENT_TYPE_OPTIONS = [
  { value: "Essay", label: "Essay" },
  { value: "Short Answers", label: "Short answers" },
];

window.SEED_ASSIGNMENT = SEED_ASSIGNMENT;
window.EMPTY_ASSIGNMENT_DRAFT = EMPTY_ASSIGNMENT_DRAFT;
window.LEVEL_OPTIONS = LEVEL_OPTIONS;
window.ASSIGNMENT_TYPE_OPTIONS = ASSIGNMENT_TYPE_OPTIONS;
