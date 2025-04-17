import {
  dummyPaymentHandler,
  DefaultJobQueuePlugin,
  DefaultSearchPlugin,
  VendureConfig,
  LanguageCode,
  DefaultAssetNamingStrategy,
} from '@vendure/core';
import {
  defaultEmailHandlers,
  EmailPlugin,
  FileBasedTemplateLoader,
} from '@vendure/email-plugin';
import {
  AssetServerPlugin,
  configureS3AssetStorage,
} from '@vendure/asset-server-plugin';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import 'dotenv/config';
import path from 'path';

const IS_DEV = process.env.APP_ENV === 'dev';
const serverPort = +process.env.PORT || 3001;
const storeFrontUrl = process.env.STORE_FRONT_URL || 'http://localhost:3000';

export const config: VendureConfig = {
  apiOptions: {
    port: serverPort,
    adminApiPath: 'admin-api',
    shopApiPath: 'shop-api',
    // The following options are useful in development mode,
    // but are best turned off for production for security
    // reasons.
    ...(IS_DEV
      ? {
          adminApiPlayground: {
            settings: { 'request.credentials': 'include' },
          },
          adminApiDebug: true,
          shopApiPlayground: {
            settings: { 'request.credentials': 'include' },
          },
          shopApiDebug: true,
        }
      : {}),
  },
  authOptions: {
    tokenMethod: ['bearer', 'cookie'],
    superadminCredentials: {
      identifier: process.env.SUPERADMIN_USERNAME,
      password: process.env.SUPERADMIN_PASSWORD,
    },
    cookieOptions: {
      secret: process.env.COOKIE_SECRET,
    },
    requireVerification: true,
  },
  dbConnectionOptions: {
    type: 'postgres',
    // See the README.md "Migrations" section for an explanation of
    // the `synchronize` and `migrations` options.
    synchronize: false,
    migrations: [path.join(__dirname, './migrations/*.+(js|ts)')],
    logging: false,
    database: process.env.DB_NAME,
    schema: process.env.DB_SCHEMA,
    host: process.env.DB_HOST,
    port: +process.env.DB_PORT,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
  },
  paymentOptions: {
    paymentMethodHandlers: [dummyPaymentHandler],
  },
  // When adding or altering custom field definitions, the database will
  // need to be updated. See the "Migrations" section in README.md.
  customFields: {
    Address: [
      {
        name: 'vatId',
        type: 'string',
        label: [
          { languageCode: LanguageCode.en, value: 'VAT ID' },
          { languageCode: LanguageCode.pl, value: 'NIP' },
        ],
        description: [
          { languageCode: LanguageCode.en, value: 'VAT Identification Number' },
          {
            languageCode: LanguageCode.pl,
            value: 'Numer Identyfikacji Podatkowej',
          },
        ],
        nullable: true,
        pattern: '^[0-9]{10}$', // Polish NIP is 10 digits
        ui: { component: 'text-form-input' },
      },
    ],
    ProductVariant: [
      {
        name: 'description',
        type: 'text',
        label: [
          { languageCode: LanguageCode.en, value: 'Description' },
          { languageCode: LanguageCode.pl, value: 'Opis' },
        ],
        description: [
          {
            languageCode: LanguageCode.en,
            value: 'Detailed description of the product variant',
          },
          {
            languageCode: LanguageCode.pl,
            value: 'Szczegółowy opis wariantu produktu',
          },
        ],
        nullable: true,
        ui: { component: 'rich-text-form-input' },
      },
    ],
  },
  plugins: [
    AssetServerPlugin.init({
      route: 'assets',
      assetUploadDir: path.join(__dirname, 'assets'),
      namingStrategy: new DefaultAssetNamingStrategy(),
      storageStrategyFactory: configureS3AssetStorage({
        bucket: process.env.MINIO_BUCKET as string,
        credentials: {
          accessKeyId: process.env.MINIO_ACCESS_KEY_ID as string,
          secretAccessKey: process.env.MINIO_SECRET_ACCESS_KEY as string,
        },
        nativeS3Configuration: {
          endpoint: process.env.MINIO_ENDPOINT as string,
          forcePathStyle: true,
          signatureVersion: 'v4',
          region: process.env.MINIO_REGION as string,
        },
      }),
    }),
    DefaultJobQueuePlugin.init({ useDatabaseForBuffer: true }),
    DefaultSearchPlugin.init({ bufferUpdates: false, indexStockStatus: true }),
    EmailPlugin.init({
      devMode: IS_DEV ? true : undefined,
      outputPath: path.join(__dirname, '../static/email/test-emails'),
      route: 'mailbox',
      handlers: defaultEmailHandlers,
      templateLoader: new FileBasedTemplateLoader(
        path.join(__dirname, '../static/email/templates')
      ),
      transport: {
        type: 'smtp',
        host: process.env.EMAIL_HOST,
        port: +process.env.EMAIL_PORT!,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      },
      globalTemplateVars: {
        // The following variables will change depending on your storefront implementation.
        fromAddress: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
        verifyEmailAddressUrl: `${storeFrontUrl}/verify`,
        passwordResetUrl: `${storeFrontUrl}/password-reset`,
        changeEmailAddressUrl: `${storeFrontUrl}/verify-email-change`,
      },
    }),
    AdminUiPlugin.init({
      route: 'admin',
      port: serverPort + 2,
      adminUiConfig: {
        apiPort: serverPort,
      },
    }),
  ],
};
