#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Aspects } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag/lib/packs/aws-solutions';
import { HIPAASecurityChecks, NagSuppressions } from 'cdk-nag';
import FhirWorksStack from '../src/lib/cdk-infra-stack';
import * as fs from 'fs';
import { FhirWorksAppRegistry } from '@aws/fhir-works-on-aws-utilities';

// initialize with defaults
const app = new cdk.App();

const allowedLogLevels = ['error', 'info', 'debug', 'warn'];
const allowedFHIRVersions = ['4.0.1', '3.0.1'];

const region: string = app.node.tryGetContext('region') || 'us-west-2';
const stage: string = app.node.tryGetContext('stage') || 'dev';
const enableMultiTenancy: boolean = app.node.tryGetContext('enableMultiTenancy') || false;
const enableSubscriptions: boolean = app.node.tryGetContext('enableSubscriptions') || false;
const useHapiValidator: boolean = app.node.tryGetContext('useHapiValidator') || false;
const enableESHardDelete: boolean = app.node.tryGetContext('enableESHardDelete') || false;
const enableBackup: boolean = app.node.tryGetContext('enableBackup') || false;
let logLevel: string = app.node.tryGetContext('logLevel') || 'error';
const fhirVersion: string = app.node.tryGetContext('fhirVersion') || '4.0.1';
const issuerEndpoint: string = app.node.tryGetContext('issuerEndpoint') || '';
const oAuth2ApiEndpoint: string = app.node.tryGetContext('oAuth2ApiEndpoint') || '';
const patientPickerEndpoint: string = app.node.tryGetContext('patientPickerEndpoint') || '';
const validateXHTML: boolean = app.node.tryGetContext('validateXHTML') || false;
const igMemoryLimit: number = app.node.tryGetContext('igMemoryLimit') || 128;
const igMemorySize: number = app.node.tryGetContext('igMemorySize') || 2048;
const igStorageSize: number = app.node.tryGetContext('igStorageSize') || 512;
const enableSecurityLogging: boolean = app.node.tryGetContext('enableSecurityLogging') || false;

// FhirWorksAppRegistry Constants
const solutionId: string = 'SO0128';
const solutionName: string = 'FHIR Works on AWS';
const solutionVersion: string = '6.0.0';
const attributeGroupName: string = 'smart-fhir-works-AttributeGroup';
const applicationType: string = 'AWS-Solutions';
const appRegistryApplicationName: string = 'smart-fhir-works-on-aws';
// workaround for https://github.com/aws/aws-cdk/issues/15054
// CDK won't allow having lock file with ".." relatively to project folder
// https://github.com/aws/aws-cdk/blob/main/packages/%40aws-cdk/aws-lambda-nodejs/lib/bundling.ts#L110
fs.copyFileSync('../../common/config/rush/pnpm-lock.yaml', './pnpm-lock.yaml');

if (issuerEndpoint.length === 0) {
  throw new Error('Error: no Issuer Endpoint specified.');
}
if (oAuth2ApiEndpoint.length === 0) {
  throw new Error('Error: no OAuth2 API Endpoint specified.');
}
if (patientPickerEndpoint.length === 0) {
  throw new Error('Error: no Patient Picker Endpoint specified.');
}

if (useHapiValidator) {
  if (!allowedFHIRVersions.includes(fhirVersion)) {
    throw new Error(`invalid FHIR Version specified: ${fhirVersion}`);
  }
}

if (!allowedLogLevels.includes(logLevel)) {
  console.log(`invalid log level specified: ${logLevel}`);
  logLevel = 'error';
}

const stack = new FhirWorksStack(app, `smart-fhir-service-${stage}`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region
  },
  tags: {
    FHIR_SERVICE: `smart-fhir-service-${region}-${stage}`
  },
  stage,
  region,
  enableMultiTenancy,
  enableSubscriptions,
  useHapiValidator,
  enableESHardDelete,
  logLevel,
  issuerEndpoint,
  oAuth2ApiEndpoint,
  patientPickerEndpoint,
  enableBackup,
  fhirVersion,
  validateXHTML,
  igMemoryLimit,
  igMemorySize,
  igStorageSize,
  description:
    '(SO0128) - Solution - Primary Template - This template creates all the necessary resources to deploy FHIR Works on AWS; a framework to deploy a FHIR server on AWS.',
  enableSecurityLogging
});
new FhirWorksAppRegistry(stack, 'SmartFhirWorksAppRegistry', {
  solutionId,
  solutionName,
  solutionVersion,
  attributeGroupName,
  applicationType,
  appRegistryApplicationName
});
fs.rm('./pnpm-lock.yaml', { force: true }, () => {});
// run cdk nag
Aspects.of(app).add(new AwsSolutionsChecks());
Aspects.of(app).add(new HIPAASecurityChecks());
NagSuppressions.addStackSuppressions(stack, [
  {
    id: 'HIPAA.Security-IAMNoInlinePolicy',
    reason: 'We use Inline policies for strict one-to-one relationships between a policy and identity'
  },
  {
    id: 'HIPAA.Security-DynamoDBInBackupPlan',
    reason: 'Backup is an optional configuration offered alongside the service in backup.ts'
  },
  {
    id: 'HIPAA.Security-LambdaInsideVPC',
    reason: 'We have a guide for users that would like to deploy resources inside a VPC'
  },
  {
    id: 'HIPAA.Security-OpenSearchInVPCOnly',
    reason: 'We have a guide for users that would like to deploy resources inside a VPC'
  },
  {
    id: 'HIPAA.Security-S3BucketReplicationEnabled',
    reason: 'S3 bucket replication is included as best practices in the deployment guide'
  },
  {
    id: 'HIPAA.Security-LambdaConcurrency',
    reason: 'Raised on a custom Lambda not created by our template'
  },
  {
    id: 'HIPAA.Security-LambdaDLQ',
    reason: 'Raised on a custom Lambda not created by our template'
  },
  {
    id: 'AwsSolutions-IAM5',
    reason: 'We only enable wildcard permissions with those resources managed by the service directly'
  },
  {
    id: 'AwsSolutions-IAM4',
    reason: 'Managed Policies are used on service-managed resources only'
  },
  {
    id: 'AwsSolutions-L1',
    reason: 'Runtime is set to NodeJs 14.x for EC2 compatibility'
  }
]);
