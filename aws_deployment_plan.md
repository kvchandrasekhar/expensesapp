# AWS Deployment Plan (CDK & CI/CD) — KV ExpenseTracker

This document outlines the step-by-step process for deploying the KV ExpenseTracker application to AWS using **Infrastructure as Code (IaC)**. We will use the **AWS Cloud Development Kit (CDK)** to fully automate infrastructure provisioning and CI/CD pipelines directly into AWS.

---

## Phase 1: CDK Initialization & Static Hosting
*Goal: Set up the CDK app and get the current static application live on the internet automatically.*

**Steps:**
1. Initialize an AWS CDK app (`npx cdk init app --language typescript`) in a new `./infrastructure` directory.
2. Define the following resources in the CDK Stack:
   - An **S3 Bucket** for hosting the static website files.
   - A **CloudFront Origin Access Control (OAC)** to ensure files are only accessible via the CDN.
   - A **CloudFront Distribution** to serve the site globally over HTTPS.
   - An `aws-s3-deployment` construct to automatically bundle and upload the local frontend files to the S3 bucket on deployment.
3. Deploy the CDK application (`npx cdk deploy`) to verify resources spin up.
4. **Verification**: Visit the CloudFront domain URL and test that the app works.

---

## Phase 2: Authentication Migration (Amazon Cognito)
*Goal: Replace local SHA-256 caching with a secure, managed cloud identity provider.*

**Steps:**
1. Add new resources to the CDK Stack:
   - A **Cognito User Pool** (Email sign-in, secure password policies).
   - A **Cognito User Pool Client** (For the frontend app to talk to Cognito).
2. Deploy the stack updates.
3. Replace browser `localStorage` authentication in `auth.js` with the Cognito SDK logic.
   - Update `register()`, `login()`, `logout()`, `getSession()`.
4. Run another deployment (or let the pipeline run if already set up).
5. **Verification**: Successfully register and sign in through the live app.

---

## Phase 3: Serverless Backend (API + Database)
*Goal: Move transaction and user settings storage from the browser to the cloud, isolated per user.*

**Steps:**
1. Add Database resources to the CDK Stack:
   - A **DynamoDB Table** for Transactions (Partition Key: `userId`, Sort Key: `txId`).
   - A **DynamoDB Table** for Settings (Partition Key: `userId`).
2. Write the backend logic (Node.js Lambda functions) in an `infrastructure/lambda` or `/backend` folder.
   - Example endpoints: `POST /transactions`, `GET /transactions`
   - **Crucial**: Ensure each function extracts `userId` from the Cognito JWT token.
3. Add API resources to the CDK Stack:
   - An **API Gateway (HTTP API)**.
   - A **Cognito Authorizer** to protect the API routes.
   - Integrate the API routes with the defined Lambda Functions.
4. Deploy the stack updates.
5. Create an `api.js` file in the frontend to replace `storage.js` logic with API `fetch()` calls.
6. **Verification**: Add a transaction, refresh the page in a different browser, and ensure the data loads from the cloud.

---

## Phase 4: CI/CD Automation
*Goal: Automate deployments so that pushing to the `main` branch automatically updates AWS.*

**Steps:**
1. Dependent on user choice: Configure **AWS CodePipeline** via CDK Pipelines OR configure a **GitHub Actions** workflow (`.github/workflows/cdk-deploy.yml`).
2. If GitHub Actions, configure **OpenID Connect (OIDC)** in AWS IAM so GitHub can securely deploy without hardcoded long-lived passwords.
3. Ensure the deployment step runs `npx cdk deploy --require-approval never`.
4. Push to GitHub.
5. **Verification**: Make a small visible change in the UI, wait a few minutes, and verify it goes live automatically.
