#!/usr/bin/env node
import 'source-map-support/register';
import { execSync } from 'child_process';
import * as cdk from 'aws-cdk-lib';
import { WgsStack } from '../lib/wgs-stack';

function resolveAccount(): string {
  const fromEnv =
    process.env.CDK_DEFAULT_ACCOUNT ?? process.env.AWS_ACCOUNT_ID;
  if (fromEnv) return fromEnv;

  try {
    const out = execSync('aws sts get-caller-identity --output json', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const account = JSON.parse(out).Account as string | undefined;
    if (account) return account;
  } catch {
    // fall through
  }

  throw new Error(
    'Set CDK_DEFAULT_ACCOUNT or configure AWS credentials (aws configure / AWS_PROFILE) so `aws sts get-caller-identity` works, then retry cdk deploy.',
  );
}

const app = new cdk.App();

const region =
  app.node.tryGetContext('region') ??
  process.env.CDK_DEFAULT_REGION ??
  process.env.AWS_REGION ??
  'us-east-1';

const account = app.node.tryGetContext('account') ?? resolveAccount();

new WgsStack(app, 'WgsStack', {
  env: { account, region },
  description: 'White Glove Source - EC2 + RDS + S3 blue/green deployment',
});
