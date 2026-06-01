# Deployment Notes

Use this file as the source of truth after context resets.

## Branch Policy

- Use `main` for all ongoing work unless the user explicitly asks for a separate branch.
- Do not use the old `amelia-agent` branch for normal work. Amelia has been implemented and merged into `main`.
- The production Vercel app is connected to the GitHub repo `jrolls0/ChristianaCarePrototype-april22` and deploys from `main`.

## Repository Location

- Work from the nested repo root: `/Users/jeremy/coding/ChristianaCare-codex/prototype`.
- This directory has its own `.git` folder. Do not run git commands from `/Users/jeremy/coding` for this project.

## Standard Commit And Deploy Flow

1. Confirm branch and status:

   ```bash
   git status -sb
   git branch --show-current
   ```

2. If not on `main`, switch to it and update it:

   ```bash
   git switch main
   git fetch origin main
   git merge --ff-only origin/main
   ```

3. Stage only relevant project files, then commit:

   ```bash
   git add <changed files>
   git commit -m "Concise change summary"
   ```

4. Run the production build before pushing:

   ```bash
   npm run build
   ```

5. Push `main`:

   ```bash
   git push origin main
   ```

6. Vercel should automatically deploy the pushed `main` commit to:

   ```text
   https://transplant-prototype.vercel.app/
   ```

## Vercel Notes

- This checkout has not historically had a local `.vercel/` project link or `vercel` CLI binary available.
- Prefer GitHub-triggered deployments by pushing `main`.
- If production does not update, check Vercel Dashboard -> Project -> Deployments and Settings -> Git:
  - Connected repo should be `jrolls0/ChristianaCarePrototype-april22`.
  - Production branch should be `main`.
  - Latest deployment commit should match `origin/main`.

## Environment Variables

- Local Amelia testing uses `prototype/.env.local`.
- Do not commit `.env.local`.
- Vercel production environment variables must be configured in the Vercel dashboard, not in Git.
