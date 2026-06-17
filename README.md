# Handoverly - Clinical ISBAR Handover System

Handoverly is a highly secure, AI-powered ISBAR (Introduction, Situation, Background, Assessment, Recommendation) clinical handover system. It is designed specifically for Aged Care and Hospital environments to assist nurses and clinical staff with generating, tracking, and completing resident handovers.

## Core Philosophy: The "Trust Core"
Handoverly operates under a strict **Deterministic Server-Side Verification** model:
> **"AI suggests, Deterministic Server Rules decide, Human approves."**

The AI (whether it's Claude, GPT-4, or a local Ollama model) is *never* allowed to write directly to the active clinical database. The AI generates structured JSON suggestions. The backend Supabase Edge Functions validate this output against rigid schemas. Only after passing these checks does the handover enter a `needs_review` state, requiring an explicit cryptographic signature (PIN) from a human clinician before the handover is published to the live longitudinal feed.

## Tech Stack
- **Framework**: Next.js 14+ (App Router)
- **Styling**: TailwindCSS (Custom Glassmorphism & Modern Enterprise Design)
- **Animation**: GSAP (GreenSock Animation Platform) for fluid timeline and transition effects
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Authentication**: Custom JWT mapping `[staff_id]@handoverly.local` (Local intranet topology)
- **Offline PWA**: Standard Service Workers caching dynamic API routes with Stale-While-Revalidate.

## Key Features
1. **Dynamic Model Routing**: Facility admins can configure and swap out the underlying AI engine without altering code. Supports OpenAI, Anthropic, Gemini, OpenRouter, Groq, and local Ollama.
2. **Offline Mode**: Handovers can be read and queued offline. Service workers cache the vital timeline.
3. **EHR Timeline**: A longitudinal feed of resident history, rather than isolated shifts.
4. **Task Extraction**: AI automatically parses "Recommendations" into actionable checklist Tasks for the next shift.
5. **Clinical PDF Export**: Instantly export a resident's vital history and handover notes into an A4 PDF for external paramedical or GP transfer.

---

## Setup Instructions

### 1. Environment Variables
Create a `.env.local` in the root of the project.

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

*Note: The AI Provider API Keys (e.g. OPENAI_API_KEY) are managed dynamically via the Admin UI and stored in the browser's Local Storage for security. They do not need to be hardcoded in the environment.*

### 2. Database Migration
All tables, schemas, policies, and triggers are consolidated into `supabase_schema.sql`.

1. Go to your Supabase SQL Editor.
2. Paste the contents of `supabase_schema.sql` and run it.
3. This will create:
   - `staff`, `wings`, `residents`, `handovers`, `tasks`, and `sirs_reports` tables.
   - Associated Row Level Security (RLS) policies based on `facility_id` from the JWT.
   - Triggers for automatic `updated_at` tracking.

### 3. Installation & Run
```bash
npm install
npm run dev
```

### 4. Initial Access
To log in for the very first time, use the **System Admin Dashboard**:
1. Navigate to `http://localhost:3000/system-admin`
2. This is a secure backdoor (ensure you lock this down in production) to generate your first Facility and Admin Staff account.
3. Once generated, use the standard `/login` route.

---

## Architecture Flow

### Authentication Flow
1. Staff member enters their Employee ID and 6-digit PIN.
2. Next.js backend intercepts, validates the hash, and generates a JWT.
3. The JWT embeds the `facility_id`.
4. Supabase reads the `facility_id` and enforces RLS, ensuring no cross-facility data leakage.

### Handover Lifecycle
1. **Drafting (`/resident/[id]/input`)**: Nurse inputs ISBAR context via forms or voice notes.
2. **AI Processing (`/resident/[id]/process`)**: Serverless function queries the selected AI model to structure and highlight high-risk vitals.
3. **Review & Sign (`/resident/[id]/review`)**: Handover is written as `needs_review`. The Nurse reviews the AI output. If incorrect, they edit. If correct, they submit their PIN to sign off.
4. **Publish**: State changes to `published`. It now appears in the global Shift feed.

## Next Steps for the Dev Team
- Lock down the `/system-admin` route (e.g., wrap it in an IP whitelist or remove it).
- Verify the Service Worker `sw.js` cache limits.
- Set up a production database instance on Supabase and run `supabase_schema.sql`.
- Configure Vercel/Netlify for deployment.
