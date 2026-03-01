import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as path from 'path';

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ==========================================
    // Phase 1: Static Website Hosting
    // ==========================================
    const siteBucket = new s3.Bucket(this, 'KVExpenseTrackerSiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    const cloudfrontOAI = new cloudfront.OriginAccessIdentity(this, 'KVExpenseTrackerOAI');
    siteBucket.grantRead(cloudfrontOAI);

    const distribution = new cloudfront.Distribution(this, 'KVExpenseTrackerDistribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: new origins.S3Origin(siteBucket, { originAccessIdentity: cloudfrontOAI }),
        compress: true,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' }
      ]
    });

    // Deploy Frontend Assets to S3 (Exclude CDK infra and dotfiles)
    new s3deploy.BucketDeployment(this, 'DeployKVExpenseTrackerWebsite', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../../'), {
        exclude: [
          'infrastructure', 'infrastructure/**', 'node_modules', 'node_modules/**',
          '.git', '.git/**', '.github', '.github/**', '.gemini', '.gemini/**',
          'README.md', 'Brand guidelines.md', 'aws_deployment_plan.md', 'aws_design_doc.md', 'Gemini.md', '.DS_Store'
        ]
      })],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'], // Invalidate cache after deployment
    });

    // ==========================================
    // Phase 2: Authentication (Cognito)
    // ==========================================
    const userPool = new cognito.UserPool(this, 'KVExpenseTrackerUserPool', {
      userPoolName: 'KVExpenseTrackerUsers',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev purposes. Change to RETAIN in prod.
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'KVExpenseTrackerUserPoolClient', {
      userPool,
      generateSecret: false, // Must be false for frontend SPA (implicit flow/public client)
      authFlows: {
        userPassword: true,
      },
      preventUserExistenceErrors: true,
    });

    // ==========================================
    // Phase 3: Serverless Backend (API & DB)
    // ==========================================
    const dynamodb = require('aws-cdk-lib/aws-dynamodb');
    const lambda = require('aws-cdk-lib/aws-lambda');
    const apigw = require('aws-cdk-lib/aws-apigateway');

    // 1. DynamoDB Tables
    const transactionsTable = new dynamodb.Table(this, 'TransactionsTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const settingsTable = new dynamodb.Table(this, 'SettingsTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 2. Lambda Function
    const apiHandler = new lambda.Function(this, 'ApiHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      handler: 'index.handler',
      environment: {
        TRANSACTIONS_TABLE: transactionsTable.tableName,
        SETTINGS_TABLE: settingsTable.tableName,
      },
    });

    transactionsTable.grantReadWriteData(apiHandler);
    settingsTable.grantReadWriteData(apiHandler);

    // 3. API Gateway with Cognito Authorizer
    const api = new apigw.RestApi(this, 'KVExpenseTrackerApi', {
      restApiName: 'KV ExpenseTracker API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    const authorizer = new apigw.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
    });

    const lambdaIntegration = new apigw.LambdaIntegration(apiHandler);

    // /transactions
    const transactions = api.root.addResource('transactions');
    transactions.addMethod('GET', lambdaIntegration, {
      authorizer, authorizationType: apigw.AuthorizationType.COGNITO
    });
    transactions.addMethod('POST', lambdaIntegration, {
      authorizer, authorizationType: apigw.AuthorizationType.COGNITO
    });

    // /transactions/{id}
    const transaction = transactions.addResource('{id}');
    transaction.addMethod('PUT', lambdaIntegration, {
      authorizer, authorizationType: apigw.AuthorizationType.COGNITO
    });
    transaction.addMethod('DELETE', lambdaIntegration, {
      authorizer, authorizationType: apigw.AuthorizationType.COGNITO
    });

    // /settings
    const settings = api.root.addResource('settings');
    settings.addMethod('GET', lambdaIntegration, {
      authorizer, authorizationType: apigw.AuthorizationType.COGNITO
    });
    settings.addMethod('POST', lambdaIntegration, {
      authorizer, authorizationType: apigw.AuthorizationType.COGNITO
    });
    settings.addMethod('PUT', lambdaIntegration, {
      authorizer, authorizationType: apigw.AuthorizationType.COGNITO
    });

    // Deploy dynamic config.js to S3
    const configData = `window.APP_CONFIG = {
      API_URL: "${api.url}",
      COGNITO_CLIENT_ID: "${userPoolClient.userPoolClientId}",
      COGNITO_REGION: "${this.region}"
    };`;

    new s3deploy.BucketDeployment(this, 'DeployKVExpenseTrackerConfig', {
      sources: [s3deploy.Source.data('config.js', configData)],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/config.js'],
    });

    // ==========================================
    // Outputs
    // ==========================================
    new cdk.CfnOutput(this, 'CloudFrontDomain', {
      value: distribution.distributionDomainName,
    });

    new cdk.CfnOutput(this, 'CognitoUserPoolId', {
      value: userPool.userPoolId,
    });

    new cdk.CfnOutput(this, 'CognitoUserPoolClientId', {
      value: userPoolClient.userPoolClientId,
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
    });
  }
}
