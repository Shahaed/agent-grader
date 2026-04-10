## Agent Grader

Prototype for rubric-aware short assignment and essay grading built with Next.js and the OpenAI Node SDK.

The core design matches the grading constraints in the product brief:

- Assignment context is persistent.
- Each submission is graded in its own isolated Responses API run.
- Shared prompt, rubric, and readings are separated from student-specific essay input.
- File search is limited to assignment-level assets through metadata filters.
- Calibration is a later optional pass over structured grading results.

## Stack

- Next.js 16 App Router
- React 19
- OpenAI Node SDK
- Responses API with structured outputs
- Vector-store-backed file search for assignment readings
- Local filesystem persistence in `.data/`

## Setup

1. Install dependencies.

```bash
npm install
```

2. Add environment variables.

```bash
cp .env.example .env.local
```

Required:

```bash
OPENAI_API_KEY=your_key_here
```

Optional model overrides:

```bash
OPENAI_RUBRIC_MODEL=gpt-5.4-mini
OPENAI_GRADING_MODEL=gpt-5.4
OPENAI_FEEDBACK_MODEL=gpt-5.4-mini
OPENAI_CALIBRATION_MODEL=gpt-5.4-mini
```

Optional development settings:

```bash
# If you open the dev server from another host or LAN IP, add it here.
ALLOWED_DEV_ORIGINS=192.168.1.21,192.168.64.1

# Override local prototype storage location if desired.
AGENT_GRADER_DATA_DIR=/absolute/path/to/agent-grader-data
```

3. Run the app.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Supported upload formats

- Rubrics: `.pdf`, `.docx`, `.txt`, `.md`, `.csv`, `.json`
- Readings and source packets: `.pdf`, `.docx`, `.txt`, `.md`, `.csv`, `.json`
- Student submissions: `.pdf`, `.docx`, `.txt`, `.md`

## Flow

1. Create an assignment.
2. Upload a rubric and optional readings.
3. Review the normalized rubric JSON and edit it if needed.
4. Upload a batch of essays.
5. The server grades each essay independently.
6. Review structured results and edit feedback.
7. Optionally run the calibration pass.

## Persistence

- Assignments, uploaded files, results, and calibration summaries are stored in `~/.agent-grader-data/assignments/` by default.
- This is intentionally outside the project directory so local runtime writes do not interfere with the Next.js dev workspace.
- This is a local prototype storage layer, not a production database.

## Verification

```bash
npm run lint
npm run build
```
