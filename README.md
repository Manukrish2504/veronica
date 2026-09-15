# Veronica

A personal job-search agent with a real UI, modelled on [MadsLorentzen/ai-job-search](https://github.com/MadsLorentzen/ai-job-search): it finds postings, scores them against your CV with the same evaluation framework (eligibility and language gates, technical 30 / experience 25 / culture 15 / career 30), drafts a tailored CV and cover letter through a drafter → reviewer → revision loop with a factual grounding audit, fills application forms in a browser for you to submit, and builds interview prep. Nothing is sent to an employer without you.

Each person creates their own account. Data is one JSON file per user under `data/` and never leaves the machine.

## Run it

Requirements: Node 22+, Google Chrome installed, and a Claude subscription signed in through Claude Code (`npm i -g @anthropic-ai/claude-code`, then run `claude` once and log in).

```bash
npm install
npm run dev          # http://localhost:3000
```

Create an account on the login screen, then in **Settings**: upload your CV (PDF), optionally your LinkedIn profile export, fill in work rights and availability, and add what you are looking for under **Looking for**. The agent searches on the schedule you pick, or press **Run search** on the Inbox.

Copy `.env.example` to `.env.local` to change the model, use an API key instead of the Claude login, or move the data directory.

## How it works

- **Sources**: LinkedIn (public search), Seek, Jora, Employment Hero Jobs, GradConnection, Remotive (remote roles), Adzuna (with free API keys), five Claude web-search sweeps per run (aggregators such as Indeed and Glassdoor; graduate boards such as GradConnection and Prosple; every major ATS board; large employers and Fortune 500 career sites; startups and scale-ups), a company watch list, and a discovery step that keeps adding companies hiring for your targets to an index that is read round-robin. Watch-list and discovered career pages are read directly through Greenhouse, Lever, Ashby, Workday, Workable, SmartRecruiters, BambooHR, Recruitee or Rippling.
- **Scoring**: one structured Claude call per posting with the reference rubric. Postings that fail a gate, need relocation or hit a deal-breaker are excluded but stay visible under the inbox and in Pipeline › Closed, with the quoted reason; you can include any of them.
- **Drafting**: shortlist a posting and the agent writes both documents from your master CV (structure preserved), a reviewer researches the company and audits every claim, then a revision applies the feedback. You approve, edit or request changes.
- **Applying**: after both documents are approved, a separate Chrome window opens on the posting, the agent fills the form and uploads the PDFs, then stops before Submit. Log in to a site once in that window and it stays logged in.
- **Interview prep**: set a status to Interview for research, STAR stories, likely questions and a mock interview.

## Develop

```bash
npm test             # pipeline tests against a fake model
npx tsc --noEmit
npm run lint
npm run build
```
