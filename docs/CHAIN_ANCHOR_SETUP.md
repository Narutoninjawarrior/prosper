# Chain Anchor Configuration Guide

The chain anchor is the final piece of the tamper-evidence loop for the Hearthlands. It takes the latest hash from `forge_log` and publishes it to an external public surface (a GitHub Gist). This proves that the receipt trail has not been retroactively altered, fulfilling the requirements for EU AI Act Article 12 compliance.

### Steps to Configure

**1. Create the Public Gist**
- Go to [gist.github.com](https://gist.github.com)
- Create a new file named `chain-anchor.json`
- Paste the following initial content:
```json
{
  "initialized": true,
  "note": "Hearthlands Collective chain anchor - forge_log hash published daily"
}
```
- Click **"Create public gist"**
- Copy the **Gist ID** from the URL (the string of characters after your username, e.g., `github.com/malaky/123abc456def`).

**2. Create a GitHub Fine-Grained Personal Access Token (PAT)**
- Go to [GitHub Settings -> Developer settings -> Personal access tokens -> Fine-grained tokens](https://github.com/settings/tokens?type=beta)
- Click **"Generate new token"**
- Name it "Hearthlands Chain Anchor"
- Set expiration (e.g., 1 year)
- Under **Account permissions**, grant **Read and Write** access to **Gists**.
- Click **"Generate token"** and copy the token (starts with `github_pat_`).

**3. Configure Firebase Environment Variables**
- Open `d:\Hearth\prosper2\functions\.env` (create it if it doesn't exist)
- Add the following lines:
```env
CHAIN_ANCHOR_GIST_ID=your_gist_id_here
CHAIN_ANCHOR_TOKEN=your_pat_here
```

**4. Deploy and Verify**
- Deploy the updated functions with environment variables:
```bash
firebase deploy --only functions
```
- Manually trigger the Steward to execute the first chain anchor sync:
```bash
gcloud scheduler jobs run firebase-schedule-lodgeSteward-us-central1 --location=us-central1
```
- Check your GitHub Gist. It should now be updated with the latest `forge_log` hash!
