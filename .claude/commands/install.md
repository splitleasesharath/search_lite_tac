# Install & Prime

## Read
README.md - Contains project overview and setup instructions

## Read and Execute
.claude/commands/prime.md

## Run
- Think through each of these steps to make sure you don't miss anything.
- Remove the existing git remote: `git remote remove origin`
- Initialize a new git repository: `git init`
- Install React component library dependencies:
  ```bash
  cd app/split-lease/components && npm install
  ```
- Install test harness dependencies:
  ```bash
  cd ../../test-harness && npm install
  ```
- Build React components to UMD bundles:
  ```bash
  cd ../split-lease/components && npm run build
  ```
- Validate the build by running tests:
  ```bash
  cd ../../test-harness && npm test
  ```

## Report
- Output the work you've just done in a concise bullet point list.
- Mention: 'You can view the application by starting a static file server in app/split-lease/pages:
  ```bash
  cd app/split-lease/pages
  npx live-server --port=8080 --no-browser
  ```
  Then navigate to http://localhost:8080'
- Mention: 'To setup your ADW workflow, be sure to update the remote repo url and push to a new repo so you have access to git issues and git prs:
  ```
  git remote add origin <your-new-repo-url>
  git push -u origin main
  ```'
- Mention: If you want to upload images to github during the review process for ADW, you can setup your cloudflare environment variables. See .env.sample for the variables.